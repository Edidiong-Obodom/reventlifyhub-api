import { pool } from "../../../../../../db";
import { TicketPurchase } from "./purchase";
import * as Helpers from "../../../../../../helpers";
import * as nodemailer from "nodemailer";
import { capitalize } from "lodash";

export const ticket_purchase_paystackWebhook = async ({
  paymentStatus,
  event,
  realAmount,
  amount,
  reference,
  userId,
  regimeId,
  pricingId,
  affiliateId,
  numberOfTickets,
  transactionType,
}: TicketPurchase): Promise<{
  status: number;
  message: string;
  error?: any;
}> => {
  try {
    // Use Promise.all for Concurrent Operations
    const [clientDetails, regimeDetails, pricingDetails, transactionExistence] =
      await Promise.all([
        Helpers.findUserById(userId),
        Helpers.getData("regimes", "id", regimeId),
        Helpers.getData("pricings", "id", pricingId),
        Helpers.getData("transactions", "transaction_reference", reference),
      ]);

    // Get all details begins
    const eventStatus = Helpers.paystackStatusHandler(event, paymentStatus);

    const { first_name, last_name, email } = clientDetails.rows[0];

    const {
      amount: pricing_amount,
      name,
      affiliate_amount,
    } = pricingDetails.rows[0];
    console.log("pricing_amount: " + pricing_amount);
    console.log("pricing_amount amount: " + amount);
    console.log(pricing_amount);
    console.log(amount);

    // Get all details ends

    // response if transaction already exists
    if (
      transactionExistence.rows.length !== 0 &&
      (transactionExistence.rows[0].status === "success" ||
        transactionExistence.rows[0].status === "failed")
    )
      return { status: 200, message: `transaction has been fulfilled already` };

    // Amount mismatch handler
    // if (pricing_amount !== amount) {
    //   // Insert into transactions table
    //   await pool.query(
    //     `INSERT INTO transactions
    //     (client_id, regime_id, transaction_reference, transaction_type, amount, currency, description, status)
    //     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    //     [
    //       userId,
    //       regimeId,
    //       reference,
    //       "debit",
    //       Number(amount),
    //       "ngn",
    //       `Transaction ${eventStatus.description}.`,
    //       eventStatus.status,
    //     ]
    //   );
    //   return {
    //     status:
    //       eventStatus.status !== "failed" && eventStatus.status !== "processed"
    //         ? 400
    //         : 200,
    //     message: "Pricing amount doesn't match amount paid.",
    //   };
    // }

    // Resppnse when payment transaction was not completed
    if (
      paymentStatus.toLowerCase() !== "success" &&
      paymentStatus.toLowerCase() !== "failed" &&
      paymentStatus.toLowerCase() !== "pending" &&
      paymentStatus.toLowerCase() !== "processed"
    )
      return {
        status: 400,
        message:
          "The transaction status from Paystack is neither successful, failed, pending nor processed.",
      };

    if (
      paymentStatus.toLowerCase() === "failed" ||
      paymentStatus.toLowerCase() === "pending" ||
      paymentStatus.toLowerCase() === "processed"
    ) {
      // Insert into transactions table
      await pool.query(
        `INSERT INTO transactions 
        (client_id, regime_id, transaction_reference, transaction_type, amount, currency, description, status) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          userId,
          regimeId,
          reference,
          "debit",
          realAmount,
          "ngn",
          `Transaction ${eventStatus.description}.`,
          eventStatus.status,
        ]
      );
      return {
        status:
          eventStatus.status !== "failed" && eventStatus.status !== "processed"
            ? 400
            : 200,
        message:
          eventStatus.status !== "failed" && eventStatus.status !== "processed"
            ? "Transaction pending."
            : "Transaction fulfilled",
      };
    }

    const { charge, paystackCharge } = Helpers.chargeHandler(
      realAmount,
      Number(numberOfTickets),
      amount
    );

    const regimeMoney = affiliateId
      ? realAmount - (charge + affiliate_amount * Number(numberOfTickets))
      : realAmount - charge;
    console.log("regimeMoney: " + regimeMoney);

    const companyMoney = charge - paystackCharge;
    await pool.query("BEGIN");
    // credits regime
    const regimeUpdate = await pool.query(
      `UPDATE regimes
    SET balance = balance + $1
    WHERE id = $2 RETURNING *`,
      [regimeMoney, regimeId]
    );
    // Use Promise.all for Concurrent Operations
    const [companyUpdate, affiliateUpdate, transaction, pricingUpdate] =
      await Promise.all([
        // credits company
        pool.query(
          `UPDATE company_funds
      SET available_balance = available_balance + $1
      WHERE currency = $2 RETURNING *`,
          [companyMoney, "ngn"]
        ),
        // credits affiliate
        affiliateId
          ? pool.query(
              `UPDATE clients
      SET balance = balance + $1
      WHERE id = $2 RETURNING *`,
              [Number(affiliate_amount * numberOfTickets), affiliateId]
            )
          : "",
        // Insert into transactions table
        pool.query(
          `INSERT INTO transactions 
        (client_id, regime_id, transaction_action, transaction_type, transaction_reference, payment_gateway, amount, currency, status) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            userId,
            regimeId,
            "ticket-purchase",
            "debit",
            reference,
            "paystack",
            Number(amount),
            "ngn",
            "success",
          ]
        ),
        // Update available seats
        pool.query(
          `UPDATE pricings SET available_seats = available_seats - $1 WHERE id = $2 RETURNING *`,
          [Number(numberOfTickets), pricingId]
        ),
      ]);

    const transactionId = transaction.rows[0].id;

    // Create tickets
    for (let i = 0; i < Number(numberOfTickets); i++) {
      await pool.query(
        `INSERT INTO tickets (pricing_id, transaction_id, buyer_id, owner_id, status, affiliate_id) VALUES ($1, $2, $3, $4, $5, $6)`,
        [pricingId, transactionId, userId, userId, "active", affiliateId]
      );
    }
    await pool.query("COMMIT");

    console.log("=======regime update=========");

    console.log(regimeUpdate.rows[0]);

    // Send email notification
    const transporter = nodemailer.createTransport(Helpers.mailCredentials);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Ticket Purchase Successful",
      text: `${capitalize(first_name)} ${capitalize(
        last_name
      )} you have successfully purchased ${Number(
        numberOfTickets
      )} ${name} ticket(s) for the regime ${regimeDetails.rows[0].name}.`,
      html: `${capitalize(first_name)} ${capitalize(
        last_name
      )} you have successfully purchased ${Number(
        numberOfTickets
      )} ${name} ticket(s) for the regime <strong>${
        regimeDetails.rows[0].name
      }</strong>.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(`Error sending email: ${error.message}`);
      }
    });
    return {
      status: 200,
      message: "Ticket Purchase Successful",
    };
  } catch (error) {
    console.log(error);
    console.log(error.message);
    await pool.query("ROLLBACK");
    return {
      status: 500,
      message: error.message,
      error,
    };
  }
};

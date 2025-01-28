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
  transactionId,
  numberOfTickets,
  transactionType,
}: TicketPurchase): Promise<{
  status: number;
  message: string;
  error?: any;
}> => {
  await pool.query("BEGIN");
  try {
    // Use Promise.all for Concurrent Operations
    const [clientDetails, regimeDetails, pricingDetails, transactionExistence] =
      await Promise.all([
        Helpers.findUserById(userId),
        Helpers.getData("regimes", "id", regimeId),
        Helpers.getData("pricings", "id", pricingId),
        Helpers.getData("transactions", "id", transactionId),
      ]);

    const { user_name, email } = clientDetails.rows[0];

    const { name, affiliate_amount } = pricingDetails.rows[0];
    // Send email notification
    const transporter = nodemailer.createTransport(Helpers.mailCredentials);

    const mailOptions = {
      from: "Reventlify <reventlifyhub@outlook.com>",
      to: email,
      subject: "Ticket Purchase Successful",
      text: `${capitalize(user_name)} you have successfully purchased ${Number(
        numberOfTickets
      )} ${name} ticket(s) for the regime ${regimeDetails.rows[0].name}.`,
      html: `${capitalize(user_name)} you have successfully purchased ${Number(
        numberOfTickets
      )} ${name} ticket(s) for the regime <strong>${
        regimeDetails.rows[0].name
      }</strong>.`,
    };

    // Get all details ends

    // response if transaction already exists
    if (
      transactionExistence.rows.length !== 0 &&
      (transactionExistence.rows[0].status === "success" ||
        transactionExistence.rows[0].status === "failed")
    )
      return { status: 200, message: `Transaction has been fulfilled already` };

    // Response when payment transaction was not completed
    if (
      paymentStatus.toLowerCase() !== "success" &&
      paymentStatus.toLowerCase() !== "failed" &&
      paymentStatus.toLowerCase() !== "pending" &&
      paymentStatus.toLowerCase() !== "processed"
    ) {
      return {
        status: 400,
        message:
          "The transaction status from Paystack is neither successful, failed, pending nor processed.",
      };
    } else if (paymentStatus.toLowerCase() === "pending") {
      return {
        status: 400,
        message: "Transaction pending...",
      };
    } else if (paymentStatus.toLowerCase() === "failed") {
      await pool.query(
        `UPDATE transactions SET status = $1, modified_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        ["failed", transactionId]
      );

      return {
        status: 200,
        message: "Transaction failed",
      };
    }

    const { charge, paystackCharge } = Helpers.chargeHandler(
      realAmount,
      Number(numberOfTickets),
      amount
    );

    const companyMoney = charge - paystackCharge;
    // Use Promise.all for Concurrent Operations
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
    ]);

    // Create tickets
    for (let i = 0; i < Number(numberOfTickets); i++) {
      await pool.query(
        `INSERT INTO tickets 
        (pricing_id, transaction_id, buyer_id, owner_id, status${
          affiliateId ? ", affiliate_id" : ""
        }) 
        VALUES ($1, $2, $3, $4, $5${affiliateId ? ", $6" : ""})`,
        affiliateId
          ? [pricingId, transactionId, userId, userId, "active", affiliateId]
          : [pricingId, transactionId, userId, userId, "active"]
      );
    }

    // Update available seats
    await pool.query(
      `UPDATE pricings SET available_seats = available_seats - $1 WHERE id = $2`,
      [Number(numberOfTickets), pricingId]
    );

    // Update transactions
    await pool.query(
      `UPDATE transactions SET status = $1, modified_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      ["success", transactionId]
    );
    await pool.query("COMMIT");

    // send mail with defined transport object
    await transporter.sendMail(mailOptions);

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

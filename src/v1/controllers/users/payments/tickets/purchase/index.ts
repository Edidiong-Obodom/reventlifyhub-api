import { pool } from "../../../../../../db";
import { TicketPurchase } from "./purchase";
import * as Helpers from "../../../../../../helpers";

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

    const { name } = pricingDetails.rows[0];
    // Send email notification
    const msg = {
      from: "Reventlify <no-reply@reventlify.com>", // sender address
      to: email, // list of receivers
      subject: "Ticket Purchase Successful", // Subject line
      text: `Hello ${user_name}, you have successfully purchased ${Number(
        numberOfTickets
      )} ${name} ticket(s) for the regime ${regimeDetails.rows[0].name}.`, // plain text body
      html: `
                        <h3 style="color: #111827;">Hello ${user_name},</h3>
                        <p style="color: #374151;">
                          You have successfully purchased ${Number(
                            numberOfTickets
                          )} ${name} ticket(s) for the regime <strong>${
        regimeDetails.rows[0].name
      }</strong>.
                        </p>
                        <p style="margin-top: 30px; color: #6b7280;">Best regards,<br />The Reventlify Team</p>`, //HTML message
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

    // Update transactions
    await pool.query(
      `UPDATE transactions SET status = $1, modified_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      ["success", transactionId]
    );

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
    await pool.query("COMMIT");

    // send mail with defined transport object
    await Helpers.sendMail({
      email: msg.to,
      subject: msg.subject,
      mailBodyText: msg.text,
      mailBodyHtml: Helpers.mailHTMLBodyLayout({
        subject: msg.subject,
        body: msg.html,
      }),
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

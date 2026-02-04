import { pool } from "../../../../../../db";
import { TicketPurchase } from "./purchase";
import * as Helpers from "../../../../../../helpers";

/**
 * Processes Paystack webhook for ticket purchases with idempotency and race condition protection.
 *
 * This function handles the fulfillment of ticket purchases after payment confirmation from Paystack.
 * It includes comprehensive safeguards against duplicate webhook processing, race conditions on seat
 * allocation, and ensures atomic transaction processing.
 *
 * @param {TicketPurchase} params - Ticket purchase webhook parameters
 * @param {string} params.paymentStatus - Payment status from Paystack (success, failed, pending, processed)
 * @param {string} params.event - Paystack event type
 * @param {number} params.realAmount - Total amount paid (in base currency units)
 * @param {number} params.amount - Amount per ticket
 * @param {string} params.reference - Paystack transaction reference
 * @param {string} params.userId - ID of the user purchasing tickets
 * @param {string} params.regimeId - ID of the regime (event)
 * @param {string} params.pricingId - ID of the pricing tier
 * @param {string} params.affiliateId - Optional affiliate ID for commission tracking
 * @param {string} params.transactionId - Internal transaction ID
 * @param {number} params.numberOfTickets - Number of tickets being purchased
 * @param {string} [params.transactionType] - Type of transaction
 *
 * @returns {Promise<{status: number, message: string, error?: any}>} Processing result
 *
 * @race-condition-protection
 * - Uses FOR UPDATE locks on transactions table to prevent duplicate webhook processing
 * - Uses FOR UPDATE locks on pricings table to prevent seat overselling
 * - Validates seat availability after acquiring lock as defensive measure
 *
 * @idempotency
 * - Checks transaction status before processing
 * - Returns success immediately if already processed
 * - Transaction ID serves as idempotency key
 *
 * @example
 * const result = await ticket_purchase_paystackWebhook({
 *   paymentStatus: 'success',
 *   event: 'charge.success',
 *   realAmount: 15000,
 *   amount: 5000,
 *   reference: 'ref_12345',
 *   userId: 'user_abc',
 *   regimeId: 'regime_xyz',
 *   pricingId: 'pricing_123',
 *   affiliateId: 'affiliate_456',
 *   transactionId: 'txn_789',
 *   numberOfTickets: 3,
 *   transactionType: 'ticket-purchase'
 * });
 * // Returns: { status: 200, message: 'Ticket Purchase Successful' }
 */
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
    // 🔒 CRITICAL: Lock the transaction row first to prevent duplicate webhook processing
    // This is the PRIMARY defense against Paystack sending duplicate webhooks
    const transactionLock = await pool.query(
      `SELECT id, status FROM transactions WHERE id = $1 FOR UPDATE`,
      [transactionId],
    );

    // Early return if transaction doesn't exist
    if (transactionLock.rows.length === 0) {
      await pool.query("ROLLBACK");
      return {
        status: 404,
        message: "Transaction not found",
      };
    }

    const currentStatus = transactionLock.rows[0].status;

    // 🛡️ Idempotency check - if already processed, return success immediately
    // This prevents duplicate ticket creation if webhook is sent multiple times
    if (currentStatus === "success" || currentStatus === "failed") {
      await pool.query("ROLLBACK");
      return {
        status: 200,
        message: `Transaction has been fulfilled already with status: ${currentStatus}`,
      };
    }

    // Validate payment status from Paystack
    const validStatuses = ["success", "failed", "pending", "processed"];
    const normalizedStatus = paymentStatus.toLowerCase();

    if (!validStatuses.includes(normalizedStatus)) {
      await pool.query("ROLLBACK");
      return {
        status: 400,
        message:
          "The transaction status from Paystack is neither successful, failed, pending nor processed.",
      };
    }

    // Handle pending status
    if (normalizedStatus === "pending") {
      await pool.query("ROLLBACK");
      return {
        status: 400,
        message: "Transaction pending...",
      };
    }

    // Handle failed payment
    if (normalizedStatus === "failed") {
      await pool.query(
        `UPDATE transactions SET status = $1, modified_at = CURRENT_TIMESTAMP WHERE id = $2`,
        ["failed", transactionId],
      );
      await pool.query("COMMIT");
      return {
        status: 200,
        message: "Transaction failed",
      };
    }

    // 🔒 Lock pricing row to prevent race conditions on seat updates
    // This ensures two concurrent webhooks can't oversell tickets
    const pricingLock = await pool.query(
      `SELECT id, available_seats, name FROM pricings WHERE id = $1 FOR UPDATE`,
      [pricingId],
    );

    if (pricingLock.rows.length === 0) {
      await pool.query("ROLLBACK");
      return {
        status: 404,
        message: "Pricing not found",
      };
    }

    const { available_seats: availableSeats, name: pricingName } =
      pricingLock.rows[0];

    // 🛡️ Defensive check: Verify seat availability even though initial purchase checked
    // This handles edge cases where seats might have been oversold due to timing issues
    if (availableSeats < Number(numberOfTickets)) {
      // Mark transaction as failed since we can't fulfill it
      await pool.query(
        `UPDATE transactions SET status = $1, modified_at = CURRENT_TIMESTAMP WHERE id = $2`,
        ["failed", transactionId],
      );
      await pool.query("COMMIT");

      return {
        status: 400,
        message: `Insufficient seats available. Available: ${availableSeats}, Requested: ${numberOfTickets}`,
      };
    }

    // Fetch other required details in parallel (no locks needed for read-only data)
    const [clientDetails, regimeDetails] = await Promise.all([
      Helpers.findUserById(userId),
      Helpers.getData("regimes", "id", regimeId),
    ]);

    if (clientDetails.rows.length === 0) {
      await pool.query("ROLLBACK");
      return {
        status: 404,
        message: "User not found",
      };
    }

    if (regimeDetails.rows.length === 0) {
      await pool.query("ROLLBACK");
      return {
        status: 404,
        message: "Regime not found",
      };
    }

    const { user_name, email } = clientDetails.rows[0];
    const { name: regimeName } = regimeDetails.rows[0];

    // Update transaction status to success
    await pool.query(
      `UPDATE transactions SET status = $1, modified_at = CURRENT_TIMESTAMP WHERE id = $2`,
      ["success", transactionId],
    );

    // Create tickets in parallel for better performance
    const ticketInserts = [];
    for (let i = 0; i < Number(numberOfTickets); i++) {
      ticketInserts.push(
        pool.query(
          `INSERT INTO tickets 
          (pricing_id, transaction_id, buyer_id, owner_id, status${
            affiliateId ? ", affiliate_id" : ""
          }) 
          VALUES ($1, $2, $3, $4, $5${affiliateId ? ", $6" : ""})`,
          affiliateId
            ? [pricingId, transactionId, userId, userId, "active", affiliateId]
            : [pricingId, transactionId, userId, userId, "active"],
        ),
      );
    }

    // Execute all ticket inserts concurrently
    await Promise.all(ticketInserts);

    // 🔒 Update available seats (safe because row is locked)
    const updatedPricing = await pool.query(
      `UPDATE pricings 
       SET available_seats = available_seats - $1 
       WHERE id = $2 
       RETURNING available_seats`,
      [Number(numberOfTickets), pricingId],
    );

    const newAvailableSeats = updatedPricing.rows[0].available_seats;

    // Commit the transaction - everything succeeded
    await pool.query("COMMIT");

    // 📧 Send email notification AFTER commit (fire and forget)
    // If email fails, the transaction is already committed successfully
    // This prevents email failures from causing transaction rollbacks
    const msg = {
      from: "Reventlify <no-reply@reventlify.com>",
      to: email,
      subject: "Ticket Purchase Successful",
      text: `Hello ${user_name}, you have successfully purchased ${Number(
        numberOfTickets,
      )} ${pricingName} ticket(s) for the regime ${regimeName}.`,
      html: `
        <h3 style="color: #111827;">Hello ${user_name},</h3>
        <p style="color: #374151;">
          You have successfully purchased ${Number(
            numberOfTickets,
          )} ${pricingName} ticket(s) for the regime <strong>${regimeName}</strong>.
        </p>
        <p style="margin-top: 30px; color: #6b7280;">Best regards,<br />The Reventlify Team</p>`,
    };

    // Send email without awaiting - don't block the response
    Helpers.sendMail({
      email: msg.to,
      subject: msg.subject,
      mailBodyText: msg.text,
      mailBodyHtml: Helpers.mailHTMLBodyLayout({
        subject: msg.subject,
        body: msg.html,
      }),
    }).catch((emailError) => {
      // Log email errors but don't fail the webhook processing
      console.error(
        "Email sending failed for transaction:",
        transactionId,
        emailError,
      );
    });

    return {
      status: 200,
      message: "Ticket Purchase Successful",
    };
  } catch (error) {
    console.error("Webhook processing error:", error);
    console.error(
      "Transaction ID:",
      transactionId,
      "Error message:",
      error.message,
    );
    await pool.query("ROLLBACK");
    return {
      status: 500,
      message: error.message,
      error,
    };
  }
};

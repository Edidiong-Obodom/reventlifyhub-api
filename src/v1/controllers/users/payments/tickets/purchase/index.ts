import { pool } from "../../../../../../db";
import { TicketPurchase } from "./purchase";
import * as Helpers from "../../../../../../helpers";

/**
 * Processes Paystack webhook for ticket purchases with idempotency and race condition protection.
 *
 * This function handles the fulfillment of ticket purchases after payment confirmation from Paystack.
 * It includes comprehensive safeguards against duplicate webhook processing, race conditions on seat
 * allocation, and ensures atomic transaction processing with optimized DB round trips for near-
 * instantaneous fulfillment.
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
 * - Acquires FOR UPDATE locks on both transactions and pricings rows concurrently (via Promise.all)
 *   to prevent duplicate webhook processing and seat overselling in a single round trip
 * - Validates seat availability after acquiring lock as a defensive measure
 *
 * @idempotency
 * - Checks transaction status before processing
 * - Returns success immediately if already processed
 * - Transaction ID serves as idempotency key
 *
 * @performance
 * - Lock acquisition on transactions and pricings runs concurrently (Promise.all) — 2 locks, 1 round trip
 * - User and regime lookups run concurrently (Promise.all)
 * - All writes (ticket inserts, transaction update, seat decrement) run concurrently (Promise.all)
 * - Ticket inserts use a single bulk INSERT regardless of quantity — O(1) round trips instead of O(n)
 * - Total DB round trips: ~4, regardless of ticket quantity
 * - Email is fire-and-forget after COMMIT to avoid blocking the response
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
    // 🔒 Combine transaction lock + pricing lock + user + regime into fewer round trips
    // Lock both rows in the same query batch to reduce round trips
    const [transactionLock, pricingLock] = await Promise.all([
      pool.query(
        `SELECT id, status FROM transactions WHERE id = $1 FOR UPDATE`,
        [transactionId],
      ),
      pool.query(
        `SELECT id, available_seats, name FROM pricings WHERE id = $1 FOR UPDATE`,
        [pricingId],
      ),
    ]);

    // Early exits
    if (transactionLock.rows.length === 0) {
      await pool.query("ROLLBACK");
      return { status: 404, message: "Transaction not found" };
    }

    const currentStatus = transactionLock.rows[0].status;
    if (currentStatus === "success" || currentStatus === "failed") {
      await pool.query("ROLLBACK");
      return {
        status: 200,
        message: `Transaction already fulfilled with status: ${currentStatus}`,
      };
    }

    const normalizedStatus = paymentStatus.toLowerCase();
    const validStatuses = ["success", "failed", "pending", "processed"];
    if (!validStatuses.includes(normalizedStatus)) {
      await pool.query("ROLLBACK");
      return { status: 400, message: "Invalid payment status from Paystack." };
    }

    if (normalizedStatus === "pending") {
      await pool.query("ROLLBACK");
      return { status: 400, message: "Transaction pending..." };
    }

    if (normalizedStatus === "failed") {
      await pool.query(
        `UPDATE transactions SET status = 'failed', modified_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transactionId],
      );
      await pool.query("COMMIT");
      return { status: 200, message: "Transaction failed" };
    }

    if (pricingLock.rows.length === 0) {
      await pool.query("ROLLBACK");
      return { status: 404, message: "Pricing not found" };
    }

    const { available_seats: availableSeats, name: pricingName } =
      pricingLock.rows[0];

    if (availableSeats < Number(numberOfTickets)) {
      await pool.query(
        `UPDATE transactions SET status = 'failed', modified_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transactionId],
      );
      await pool.query("COMMIT");
      return {
        status: 400,
        message: `Insufficient seats. Available: ${availableSeats}, Requested: ${numberOfTickets}`,
      };
    }

    // Fetch user + regime concurrently while we already hold the locks
    const [clientDetails, regimeDetails] = await Promise.all([
      Helpers.findUserById(userId),
      Helpers.getData("regimes", "id", regimeId),
    ]);

    if (clientDetails.rows.length === 0) {
      await pool.query("ROLLBACK");
      return { status: 404, message: "User not found" };
    }
    if (regimeDetails.rows.length === 0) {
      await pool.query("ROLLBACK");
      return { status: 404, message: "Regime not found" };
    }

    const { user_name, email } = clientDetails.rows[0];
    const { name: regimeName } = regimeDetails.rows[0];
    const count = Number(numberOfTickets);

    // ⚡ Bulk insert all tickets in ONE query instead of N queries
    const ticketValues = Array.from({ length: count }, (_, i) => {
      const base = i * (affiliateId ? 6 : 5);
      return affiliateId
        ? `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
        : `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    }).join(", ");

    const ticketParams: any[] = [];
    for (let i = 0; i < count; i++) {
      ticketParams.push(pricingId, transactionId, userId, userId, "active");
      if (affiliateId) ticketParams.push(affiliateId);
    }

    const affiliateCols = affiliateId ? ", affiliate_id" : "";
    await Promise.all([
      // Bulk ticket insert
      pool.query(
        `INSERT INTO tickets (pricing_id, transaction_id, buyer_id, owner_id, status${affiliateCols}) VALUES ${ticketValues}`,
        ticketParams,
      ),
      // Update transaction status
      pool.query(
        `UPDATE transactions SET status = 'success', modified_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transactionId],
      ),
      // Decrement seats
      pool.query(
        `UPDATE pricings SET available_seats = available_seats - $1 WHERE id = $2`,
        [count, pricingId],
      ),
    ]);

    await pool.query("COMMIT");

    // 📧 Fire-and-forget email (unchanged)
    Helpers.sendMail({
      email,
      subject: "Ticket Purchase Successful",
      mailBodyText: `Hello ${user_name}, you purchased ${count} ${pricingName} ticket(s) for ${regimeName}.`,
      mailBodyHtml: Helpers.mailHTMLBodyLayout({
        subject: "Ticket Purchase Successful",
        body: `
          <h3 style="color: #111827;">Hello ${user_name},</h3>
          <p style="color: #374151;">You have successfully purchased ${count} ${pricingName} ticket(s) for <strong>${regimeName}</strong>.</p>
          <p style="margin-top: 30px; color: #6b7280;">Best regards,<br />The Reventlify Team</p>`,
      }),
    }).catch((err) =>
      console.error("Email failed for transaction:", transactionId, err),
    );

    return { status: 200, message: "Ticket Purchase Successful" };
  } catch (error) {
    console.error("Webhook error:", transactionId, error.message);
    await pool.query("ROLLBACK");
    return { status: 500, message: error.message, error };
  }
};

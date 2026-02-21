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
 * @param {string} params.userId - ID of the user purchasing tickets
 * @param {string} params.regimeId - ID of the regime (event)
 * @param {string} params.pricingId - ID of the pricing tier
 * @param {string} params.affiliateId - Optional affiliate ID for commission tracking
 * @param {string} params.transactionId - Internal transaction ID
 * @param {number} params.numberOfTickets - Number of tickets being purchased
 *
 * @returns {Promise<{status: number, message: string, error?: any}>} Processing result
 *
 * @race-condition-protection
 * - Uses FOR UPDATE NOWAIT on the transactions row — instantly rejects duplicate webhooks
 *   that arrive while the first is still processing (Postgres error code 55P03)
 * - Seat decrement uses a conditional UPDATE with AND available_seats >= $1, making the
 *   row lock and availability check a single atomic operation with no explicit SELECT needed
 *
 * @idempotency
 * - Payload is validated before a pool client is checked out
 * - Transaction row is locked and its status checked before any writes
 * - Returns early if transaction is already fulfilled (success or failed)
 * - Transaction ID serves as idempotency key
 *
 * @performance
 * - Pool client is checked out only after early validation passes — invalid requests
 *   never touch the connection pool
 * - Single dedicated pool client used throughout — all queries are truly atomic under BEGIN/COMMIT
 * - Ticket inserts use generate_series for a single bulk INSERT regardless of ticket count — O(1) round trips
 * - Writes are sequential by design: tickets → seats → transaction status. This ordering ensures
 *   the DB trigger (handle_inter_debit_ticket_purchase) fires only after tickets and seat counts
 *   are already committed to the transaction snapshot it reads from
 * - Email is fire-and-forget after COMMIT to avoid blocking the response
 * - Pool client is always released in a finally block to prevent connection leaks
 *
 * @example
 * const result = await ticket_purchase_paystackWebhook({
 *   paymentStatus: 'success',
 *   userId: 'user_abc',
 *   regimeId: 'regime_xyz',
 *   pricingId: 'pricing_123',
 *   affiliateId: 'affiliate_456',
 *   transactionId: 'txn_789',
 *   numberOfTickets: 3,
 * });
 * // Returns: { status: 200, message: 'Ticket Purchase Successful' }
 */

export const ticket_purchase_paystackWebhook = async ({
  paymentStatus,
  userId,
  regimeId,
  pricingId,
  affiliateId,
  transactionId,
  numberOfTickets,
}: TicketPurchase): Promise<{
  status: number;
  message: string;
  error?: any;
}> => {
  const count = Number(numberOfTickets || 0);
  const normalizedStatus = String(paymentStatus || "").toLowerCase();

  // Early validation before opening a transaction
  const validStatuses = ["success", "failed", "pending", "processed"];
  if (!validStatuses.includes(normalizedStatus)) {
    return { status: 400, message: "Invalid payment status from Paystack." };
  }
  if (normalizedStatus === "pending") {
    return { status: 200, message: "Transaction pending..." };
  }
  if (!transactionId || !pricingId || !regimeId || !userId || count <= 0) {
    return { status: 400, message: "Invalid payload." };
  }
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) Lock transaction row (idempotency check)
    let txRes;
    try {
      txRes = await client.query(
        `SELECT id, status FROM transactions WHERE id = $1 FOR UPDATE NOWAIT`,
        [transactionId],
      );
    } catch (e: any) {
      if (e?.code === "55P03") {
        await client.query("ROLLBACK");
        return { status: 200, message: "Transaction already processing." };
      }
      throw e;
    }

    if (txRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: 404, message: "Transaction not found" };
    }

    const currentStatus = txRes.rows[0].status;
    if (currentStatus === "success" || currentStatus === "failed") {
      await client.query("ROLLBACK");
      return { status: 200, message: `Already fulfilled: ${currentStatus}` };
    }

    // 2) Finalize failed payment
    if (normalizedStatus === "failed") {
      await client.query(
        `UPDATE transactions SET status = 'failed', modified_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transactionId],
      );
      await client.query("COMMIT");
      return { status: 200, message: "Transaction failed" };
    }

    // 3) Atomically decrement seats — the UPDATE itself acts as the lock + availability check
    const pricingRes = await client.query(
      `UPDATE pricings
          SET available_seats = available_seats - $1
        WHERE id = $2
          AND available_seats >= $1
        RETURNING name`,
      [count, pricingId],
    );

    if (pricingRes.rows.length === 0) {
      await client.query(
        `UPDATE transactions SET status = 'failed', modified_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transactionId],
      );
      await client.query("COMMIT");
      return {
        status: 400,
        message: "Insufficient seats or pricing not found.",
      };
    }

    const { name: pricingName } = pricingRes.rows[0];

    // 4) Fetch user + regime — sequential on the same client (parallel here is illusory
    //    since a single pg client processes queries serially anyway)
    const userRes = await client.query(
      `SELECT user_name, email FROM clients WHERE id = $1`,
      [userId],
    );
    const regimeRes = await client.query(
      `SELECT name FROM regimes WHERE id = $1`,
      [regimeId],
    );

    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: 404, message: "User not found" };
    }
    if (regimeRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: 404, message: "Regime not found" };
    }

    const { user_name, email } = userRes.rows[0];
    const { name: regimeName } = regimeRes.rows[0];

    // 5) Bulk insert tickets via generate_series — one query regardless of count
    if (affiliateId) {
      await client.query(
        `INSERT INTO tickets (pricing_id, transaction_id, buyer_id, owner_id, status, affiliate_id)
         SELECT $1, $2, $3, $3, 'active', $4
           FROM generate_series(1, $5)`,
        [pricingId, transactionId, userId, affiliateId, count],
      );
    } else {
      await client.query(
        `INSERT INTO tickets (pricing_id, transaction_id, buyer_id, owner_id, status)
         SELECT $1, $2, $3, $3, 'active'
           FROM generate_series(1, $4)`,
        [pricingId, transactionId, userId, count],
      );
    }

    // 6) LAST: mark success — DB trigger fires here and expects tickets + seats
    //    to already be updated within this transaction snapshot
    await client.query(
      `UPDATE transactions SET status = 'success', modified_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [transactionId],
    );

    await client.query("COMMIT");

    // Fire-and-forget email after commit — failure here doesn't affect fulfillment
    Helpers.sendMail({
      email,
      subject: "Ticket Purchase Successful",
      mailBodyText: `Hello ${user_name}, you purchased ${count} ${pricingName} ticket(s) for ${regimeName}.`,
      mailBodyHtml: Helpers.mailHTMLBodyLayout({
        subject: "Ticket Purchase Successful",
        body: `
          <h3 style="color: #111827;">Hello ${user_name},</h3>
          <p style="color: #374151;">
            You have successfully purchased ${count} ${pricingName} ticket(s) for <strong>${regimeName}</strong>.
          </p>
          <p style="margin-top: 30px; color: #6b7280;">Best regards,<br />The Reventlify Team</p>`,
      }),
    }).catch((err) => console.error("Email failed:", transactionId, err));

    return { status: 200, message: "Ticket Purchase Successful" };
  } catch (error: any) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    return { status: 500, message: error?.message || "Webhook error", error };
  } finally {
    client.release();
  }
};

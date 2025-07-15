import { Request, Response } from "express";
import { pool } from "../../../../../../db";

/**
 * Allows user to **search their transaction history** with filters and pagination.
 *
 * Searchable fields:
 * - Regime name
 * - Transaction type
 * - Transaction status
 *
 * Filters:
 * - Search query (`searchTerm`)
 * - Date range (`startDate`, `endDate`)
 * - Automatically excludes transactions involving company or regime balances
 *   by applying the following logic:
 *
 *   Shows only if:
 *   - inter-credit: for client (e.g., affiliate reward)
 *   - inter-debit: from same client to payment gateway (non-recursive)
 *   - intra-credit: internal credit to self (e.g., refunds)
 *   - intra-debit: debit without specific beneficiary (e.g., ticket purchase)
 *
 * Pagination:
 * - Query params: `page`, `limit`
 *
 * Response: JSON with `data[]`, `page`, `limit`, and `total`
 */
export const transactionSearch = async (req: Request, res: Response) => {
  const userId = req.user;
  const {
    searchTerm,
    page = 1,
    limit = 10,
    startDate,
    endDate,
  } = req.query as any;
  const offset = (page - 1) * limit;

  const params: any[] = [userId];

  let whereClause = `WHERE (t.client_id = $1 OR t.beneficiary = $1)`;

  if (searchTerm) {
    params.push(`%${searchTerm.toLowerCase()}%`);
    whereClause += ` AND (
      LOWER(r.name) LIKE $${params.length} OR
      LOWER(t.transaction_type) LIKE $${params.length} OR
      LOWER(t.status) LIKE $${params.length}
    )`;
  }

  if (startDate && endDate) {
    params.push(startDate, endDate);
    whereClause += ` AND t.created_at BETWEEN $${params.length - 1} AND $${
      params.length
    }`;
  }

  whereClause += `
  AND (
    (t.transaction_type = 'inter-credit' AND t.company IS NULL AND t.beneficiary IS NOT NULL AND t.beneficiary = $1)
    OR (t.transaction_type = 'inter-debit' AND t.company IS NULL AND t.is_recursion = false)
    OR (t.transaction_type = 'intra-credit' AND t.company IS NULL AND t.beneficiary IS NOT NULL AND t.client_id = t.beneficiary)
    OR (t.transaction_type = 'intra-debit' AND t.company IS NULL AND t.beneficiary IS NULL)
  )
`;

  try {
    const result = await pool.query(
      `SELECT t.*, r.name as regime_name, u.user_name as affiliate_user_name
       FROM transactions t
       LEFT JOIN regimes r ON t.regime_id = r.id
       LEFT JOIN clients u ON t.affiliate_id = u.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const total = await pool.query(
      `SELECT COUNT(*) FROM transactions t
       LEFT JOIN regimes r ON t.regime_id = r.id
       ${whereClause}`,
      params
    );

    return res.status(200).json({
      message: "Search results fetched successfully",
      data: result.rows,
      page: Number(page),
      limit: Number(limit),
      total: Number(total.rows[0].count),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

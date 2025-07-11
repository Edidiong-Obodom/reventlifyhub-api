import { Response } from "express";
import { pool } from "../../../../../../db";
import * as Helpers from "../../../../../../helpers";
import { ExtendedRequest } from "../../../../../../utilities/authenticateToken/authenticateToken.dto";

export const transactionList = async (req: ExtendedRequest, res: Response) => {
  const userId = req.user;
  const { page = 1, limit = 10, startDate, endDate } = req.query as any;

  const offset = (page - 1) * limit;
  const params: any[] = [userId];
  let whereClause = `WHERE t.client_id = $1`;

  if (startDate && endDate) {
    params.push(startDate, endDate);
    whereClause += ` AND t.created_at BETWEEN $${params.length - 1} AND $${
      params.length
    }`;
  }

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
      `SELECT COUNT(*) FROM transactions t ${whereClause}`,
      params
    );

    return res.status(200).json({
      message: "Transactions fetched successfully",
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

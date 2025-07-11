import { Response } from "express";
import { pool } from "../../../../../../db";
import { ExtendedRequest } from "../../../../../../utilities/authenticateToken/authenticateToken.dto";

export const ticketSearch = async (req: ExtendedRequest, res: Response) => {
  try {
    const userId = req.user;
    const {
      searchTerm,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query as {
      searchTerm?: string;
      page?: string;
      limit?: string;
      startDate?: string;
      endDate?: string;
    };

    const offset = (Number(page) - 1) * Number(limit);

    const filters: string[] = [`(t.owner_id = $1 OR t.buyer_id = $1)`];
    const values: any[] = [userId];

    if (searchTerm) {
      filters.push(`(
        LOWER(p.name) LIKE LOWER($${values.length + 1}) OR 
        CAST(p.amount AS TEXT) LIKE $${values.length + 1} OR 
        LOWER(r.name) LIKE LOWER($${values.length + 1}) OR 
        LOWER(r.status) LIKE LOWER($${values.length + 1})
      )`);
      values.push(`%${searchTerm}%`);
    }

    if (startDate && endDate) {
      filters.push(
        `t.created_at BETWEEN $${values.length + 1} AND $${values.length + 2}`
      );
      values.push(startDate, endDate);
    }

    const query = `
      SELECT 
        t.id,
        t.pricing_id,
        t.owner_id,
        t.buyer_id,
        t.transaction_id,
        t.created_at,
        CASE WHEN t.owner_id != t.buyer_id THEN true ELSE false END AS is_transferred,
        p.name AS pricing_name,
        p.amount AS pricing_amount,
        r.id AS regime_id,
        r.name AS regime_name,
        r.venue,
        r.address,
        r.city,
        r.state,
        r.country,
        r.type,
        r.media,
        r.status AS regime_status,
        r.start_date,
        r.end_date,
        r.start_time,
        r.end_time,
        c.id AS creator_id,
        c.user_name AS creator_user_name
      FROM tickets t
      JOIN pricings p ON t.pricing_id = p.id
      JOIN regimes r ON p.regime_id = r.id
      JOIN clients c ON r.creator_id = c.id
      WHERE ${filters.join(" AND ")}
      ORDER BY t.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    values.push(Number(limit), offset);

    const result = await pool.query(query, values);

    return res.status(200).json({
      message: "Search results",
      data: result.rows,
      meta: {
        page: Number(page),
        limit: Number(limit),
        count: result.rowCount,
      },
    });
  } catch (error) {
    console.error("Error searching tickets:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

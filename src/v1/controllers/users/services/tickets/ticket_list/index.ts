import { Request, Response } from "express";
import { pool } from "../../../../../../db";

export const ticketList = async (req: Request, res: Response) => {
  try {
    const userId = req.user;
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query as {
      page?: string;
      limit?: string;
      startDate?: string;
      endDate?: string;
    };

    const offset = (Number(page) - 1) * Number(limit);

    const filters: string[] = [`(t.owner_id = $1 OR t.buyer_id = $1)`];
    const values: any[] = [userId];

    if (startDate && endDate) {
      filters.push(
        `t.created_at BETWEEN $${values.length + 1} AND $${values.length + 2}`,
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
        c.email AS creator_email,
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

    const structuredTickets = result.rows.map((row) => ({
      id: row.id,
      pricing_id: row.pricing_id,
      owner_id: row.owner_id,
      buyer_id: row.buyer_id,
      transaction_id: row.transaction_id,
      is_transferred: row.is_transferred,
      created_at: row.created_at,
      pricing: {
        name: row.pricing_name,
        amount: Number(row.pricing_amount),
        regime: {
          id: row.regime_id,
          name: row.regime_name,
          venue: row.venue,
          address: row.address,
          city: row.city,
          state: row.state,
          country: row.country,
          type: row.type,
          media: row.media,
          status: row.regime_status,
          start_date: row.start_date,
          end_date: row.end_date,
          start_time: row.start_time,
          end_time: row.end_time,
          creator: {
            id: row.creator_id,
            user_name: row.creator_user_name,
            email: row.creator_email,
          },
        },
      },
    }));

    return res.status(200).json({
      success: true,
      data: structuredTickets,
      page: Number(page),
      limit: Number(limit),
      total: result.rowCount,
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

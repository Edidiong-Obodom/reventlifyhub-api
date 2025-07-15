import { Request, Response } from "express";
import * as Helpers from "../../../../../../../helpers";
import { pool } from "../../../../../../../db";

export const searchEvents = async (req: Request, res: Response) => {
  try {
    const { searchString, type, page = "1", limit = "20" } = req.query;

    if (!searchString || typeof searchString !== "string") {
      return res.status(400).json({
        success: false,
        message: "searchString query parameter is required.",
      });
    }

    if (isNaN(Number(page)) || isNaN(Number(limit))) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be numeric values.",
      });
    }

    const offset = (Number(page) - 1) * Number(limit);

    // Prepare query parameters
    const values: any[] = [
      searchString.trim(),
      `%${Helpers.deSlugify(searchString).trim()}%`,
    ];

    let baseQuery = `
      SELECT 
          r.id,
          r.name,
          r.type,
          r.creator_id,
          c.user_name AS creator_user_name,
          c.photo AS creator_photo,
          r.address,
          r.city,
          r.state,
          r.country,
          r.description,
          r.venue,
          r.start_date,
          r.start_time,
          r.end_date,
          r.end_time,
          r.media AS regime_banner,
          ARRAY_REMOVE(ARRAY[r.media_i, r.media_ii, r.media_iii, r.media_iv], NULL) AS regime_gallery,
          COALESCE(SUM(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_ticket_sales,
          COALESCE(SUM(CASE WHEN t.id IS NOT NULL THEN p.amount ELSE 0 END), 0) AS total_revenue,
          COALESCE(
              JSON_AGG(
                  DISTINCT JSONB_BUILD_OBJECT(
                      'id', p.id,
                      'name', p.name,
                      'total_seats', p.total_seats,
                      'available_seats', p.available_seats,
                      'amount', p.amount
                  )
              ) FILTER (WHERE p.id IS NOT NULL), '[]'
          ) AS pricings
      FROM regimes r
      JOIN clients c ON r.creator_id = c.id
      LEFT JOIN pricings p ON r.id = p.regime_id
      LEFT JOIN tickets t ON p.id = t.pricing_id
      WHERE (r.status = 'pending' OR r.status = 'ongoing')
        AND (r.end_date + r.end_time)::timestamp > CURRENT_TIMESTAMP
        AND (
          r.id = $1 OR
          r.name ILIKE $2 OR
          r.venue ILIKE $2 OR
          r.address ILIKE $2 OR
          r.city ILIKE $2 OR
          r.state ILIKE $2 OR
          r.country ILIKE $2
        )
    `;

    if (type) {
      values.push(type);
      baseQuery += ` AND r.type = $${values.length}`;
    }

    baseQuery += `
      GROUP BY r.id, c.id
      ORDER BY r.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2};
    `;

    values.push(Number(limit), offset);

    const result = await pool.query(baseQuery, values);

    return res.status(200).json({
      success: true,
      data: result.rows,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("Error searching events:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

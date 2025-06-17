import { Response } from "express";
import { ExtendedRequest } from "../../../../../../../utilities/authenticateToken/authenticateToken.dto";
import { pool } from "../../../../../../../db";

export const getAllEvents = async (req: ExtendedRequest, res: Response) => {
  try {
    const {
      country,
      state,
      city,
      address,
      id,
      name,
      venue,
      page = "1",
      limit = "20",
    } = req.query;

    if (isNaN(Number(page)) || isNaN(Number(limit))) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be numeric values.",
      });
    }

    const offset = (Number(page) - 1) * Number(limit);

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
    `;

    const conditions = [];
    const values: any[] = [];

    if (country) {
      conditions.push(`r.country ILIKE $${values.length + 1}`);
      values.push(`%${country}%`);
    }
    if (state) {
      conditions.push(`r.state ILIKE $${values.length + 1}`);
      values.push(`%${state}%`);
    }
    if (city) {
      conditions.push(`r.city ILIKE $${values.length + 1}`);
      values.push(`%${city}%`);
    }
    if (address) {
      conditions.push(`r.address ILIKE $${values.length + 1}`);
      values.push(`%${address}%`);
    }
    if (id) {
      conditions.push(`r.id = $${values.length + 1}`);
      values.push(id);
    }
    if (name) {
      conditions.push(`r.name ILIKE $${values.length + 1}`);
      values.push(`%${name}%`);
    }
    if (venue) {
      conditions.push(`r.venue ILIKE $${values.length + 1}`);
      values.push(`%${venue}%`);
    }

    if (conditions.length > 0) {
      baseQuery += ` AND ${conditions.join(" AND ")}`;
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
    console.error("Error fetching events with creator info:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

import { Response } from "express";
import { ExtendedRequest } from "../../../../../../../utilities/authenticateToken/authenticateToken.dto";
import { pool } from "../../../../../../../db";

export const byPopularity = async (req: ExtendedRequest, res: Response) => {
  try {
    const { country, state, address, page = "1", limit = "20" } = req.query;
    if (isNaN(Number(page))) {
      return res.status(400).json({
        success: false,
        message: "Page query param must be a number.",
      });
    }
    if (isNaN(Number(limit))) {
      return res.status(400).json({
        success: false,
        message: "Limit query param must be a number.",
      });
    }

    const offset = (Number(page) - 1) * Number(limit);

    let query = `
            SELECT r.id, r.name, r.address, r.city, r.state, r.country, COUNT(t.id) AS ticket_sales
            FROM regimes r
            JOIN pricings p ON r.id = p.regime_id
            JOIN tickets t ON p.id = t.pricing_id
            WHERE r.status = 'pending'
        `;

    const values = [];
    let conditions = [];

    if (country) {
      conditions.push(`r.country = $${values.length + 1}`);
      values.push(country);
    }
    if (state) {
      conditions.push(`r.state = $${values.length + 1}`);
      values.push(state);
    }
    if (address) {
      conditions.push(`r.address = $${values.length + 1}`);
      values.push(address);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(" AND ")}`;
    }

    query += `
            GROUP BY r.id
            ORDER BY ticket_sales DESC
            LIMIT $${values.length + 1} OFFSET $${values.length + 2};
        `;

    values.push(Number(limit), offset);

    const result = await pool.query(query, values);
    return res.status(200).json({
      success: true,
      data: result.rows,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("Error fetching popular events:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

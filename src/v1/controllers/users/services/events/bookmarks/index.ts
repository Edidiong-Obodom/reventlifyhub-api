import { Request, Response } from "express";
import { pool } from "../../../../../../db";
import * as Helpers from "../../../../../../helpers";

export const bookmarkRegime = async (req: Request, res: Response) => {
  const fields = ["regimeId"];
  const fieldCheck = Helpers.requiredFields(req.body, fields);

  if (!fieldCheck.success) {
    return res.status(400).json({ message: fieldCheck.message });
  }

  const { regimeId, ...rest } = req.body as { regimeId: string };
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    return res.status(400).json({ message: extraFields.message });
  }

  const userId = req.user;

  try {
    const regimeCheck = await pool.query(
      "SELECT id FROM regimes WHERE id = $1 AND is_deleted = false",
      [regimeId],
    );

    if (regimeCheck.rows.length === 0) {
      return res.status(404).json({ message: "Regime not found." });
    }

    const existing = await pool.query(
      "SELECT id, is_deleted FROM regime_bookmarks WHERE client_id = $1 AND regime_id = $2",
      [userId, regimeId],
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].is_deleted) {
        await pool.query(
          "UPDATE regime_bookmarks SET is_deleted = false, modified_at = CURRENT_TIMESTAMP WHERE id = $1",
          [existing.rows[0].id],
        );
      }

      return res.status(200).json({ success: true, bookmarked: true });
    }

    await pool.query(
      "INSERT INTO regime_bookmarks(client_id, regime_id) VALUES($1, $2) RETURNING *",
      [userId, regimeId],
    );

    return res.status(200).json({ success: true, bookmarked: true });
  } catch (error) {
    return res
      .status(500)
      .json({ message: error?.message ?? error?.toString() });
  }
};

export const unbookmarkRegime = async (req: Request, res: Response) => {
  const fields = ["regimeId"];
  const fieldCheck = Helpers.requiredFields(req.body, fields);

  if (!fieldCheck.success) {
    return res.status(400).json({ message: fieldCheck.message });
  }

  const { regimeId, ...rest } = req.body as { regimeId: string };
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    return res.status(400).json({ message: extraFields.message });
  }

  const userId = req.user;

  try {
    const result = await pool.query(
      "UPDATE regime_bookmarks SET is_deleted = true, modified_at = CURRENT_TIMESTAMP WHERE client_id = $1 AND regime_id = $2 AND is_deleted = false RETURNING id",
      [userId, regimeId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Bookmark not found." });
    }

    return res.status(200).json({ success: true, bookmarked: false });
  } catch (error) {
    return res
      .status(500)
      .json({ message: error?.message ?? error?.toString() });
  }
};

export const listBookmarks = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20" } = req.query;

    if (isNaN(Number(page)) || isNaN(Number(limit))) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be numeric values.",
      });
    }

    const userId = req.user;
    const offset = (Number(page) - 1) * Number(limit);

    const values: any[] = [userId, Number(limit), offset];

    const query = `
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
          ) AS pricings,
          MAX(b.created_at) AS bookmarked_at,
          true AS is_bookmarked
      FROM regime_bookmarks b
      JOIN regimes r ON b.regime_id = r.id
      JOIN clients c ON r.creator_id = c.id
      LEFT JOIN pricings p ON r.id = p.regime_id
      LEFT JOIN tickets t ON p.id = t.pricing_id
      WHERE b.client_id = $1 AND b.is_deleted = false
        AND r.is_deleted = false
        AND (r.status = 'pending' OR r.status = 'ongoing')
        AND (r.end_date + r.end_time)::timestamp > CURRENT_TIMESTAMP
      GROUP BY r.id, c.id
      ORDER BY bookmarked_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      data: result.rows,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const listBookmarkIds = async (req: Request, res: Response) => {
  try {
    const userId = req.user;
    const result = await pool.query(
      "SELECT regime_id FROM regime_bookmarks WHERE client_id = $1 AND is_deleted = false",
      [userId],
    );

    return res.status(200).json({
      success: true,
      data: result.rows.map((row) => row.regime_id),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

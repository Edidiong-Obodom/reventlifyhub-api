import { Request, Response } from "express";
import { pool } from "../../../../../db";
import * as Helpers from "../../../../../helpers";
import cloudinary from "../../../../../utilities/cloudinary";

const reverseGeocode = async (lat: number, lon: number) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "reventlifyhub/1.0 (support@reventlify.com)",
    },
  });

  if (!response.ok) {
    throw new Error("Reverse geocoding failed.");
  }

  const data = await response.json();
  const address = data?.address ?? {};
  const city =
    address.city || address.town || address.village || address.county || null;
  const state = address.state || address.region || null;
  const country = address.country || null;
  const fullAddress = data?.display_name || null;

  return {
    address: fullAddress,
    city,
    state,
    country,
  };
};

export const getProfile = async (req: Request, res: Response) => {
  const userId = req.user;

  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, user_name, email, photo, bio, interests,
              address, city, state, country, last_location_update,
              (SELECT COUNT(*) FROM followers WHERE influencer = clients.id AND is_deleted = false) AS followers_count,
              (SELECT COUNT(*) FROM followers WHERE follower = clients.id AND is_deleted = false) AS following_count
       FROM clients WHERE id = $1 AND is_deleted = false`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = result.rows[0];
    const nameParts = [user.first_name, user.last_name].filter(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: nameParts.join(" ").trim(),
        firstName: user.first_name,
        lastName: user.last_name,
        userName: user.user_name,
        email: user.email,
        photo: user.photo,
        bio: user.bio,
        interests: user.interests ?? [],
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        lastLocationUpdate: user.last_location_update,
        followersCount: Number(user.followers_count ?? 0),
        followingCount: Number(user.following_count ?? 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message ?? error?.toString() });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const { name, bio, interests, photoBase64, ...rest } = req.body as {
    name?: string;
    bio?: string;
    interests?: string[];
    photoBase64?: string | null;
  };

  const extraFields = Helpers.noExtraFields(rest);
  if (!extraFields.success) {
    return res.status(400).json({ message: extraFields.message });
  }

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (typeof name === "string") {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({ message: "Name cannot be empty." });
    }
    const parts = trimmedName.split(/\s+/);
    const firstName = parts.shift();
    const lastName = parts.length > 0 ? parts.join(" ") : null;
    updates.push(`first_name = $${idx++}`);
    values.push(firstName);
    updates.push(`last_name = $${idx++}`);
    values.push(lastName);
  }

  if (typeof bio === "string") {
    updates.push(`bio = $${idx++}`);
    values.push(bio);
  }

  if (interests !== undefined) {
    if (!Array.isArray(interests)) {
      return res
        .status(400)
        .json({ message: "Interests must be an array." });
    }
    updates.push(`interests = $${idx++}`);
    values.push(interests.map(String));
  }

  let photoUrl: string | undefined;
  let photoId: string | undefined;

  if (photoBase64 !== undefined) {
    if (photoBase64 === null || photoBase64 === "") {
      updates.push(`photo = $${idx++}`);
      values.push(null);
      updates.push(`photo_id = $${idx++}`);
      values.push(null);
    } else {
      if (Helpers.sizeChecker(photoBase64).MB > 10) {
        return res.status(400).json({ message: "Photo larger than 10MB" });
      }
      const upload = await cloudinary.uploader.upload(photoBase64, {
        folder: "profile_photos",
      });
      photoUrl = upload.secure_url;
      photoId = upload.public_id;
      updates.push(`photo = $${idx++}`);
      values.push(photoUrl);
      updates.push(`photo_id = $${idx++}`);
      values.push(photoId);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No fields to update." });
  }

  updates.push(`modified_at = CURRENT_TIMESTAMP`);
  values.push(req.user);

  try {
    const query = `
      UPDATE clients
      SET ${updates.join(", ")}
      WHERE id = $${idx}
      RETURNING id, first_name, last_name, user_name, email, photo, bio, interests,
                address, city, state, country, last_location_update;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = result.rows[0];
    const counts = await pool.query(
      `SELECT 
          (SELECT COUNT(*) FROM followers WHERE influencer = $1 AND is_deleted = false) AS followers_count,
          (SELECT COUNT(*) FROM followers WHERE follower = $1 AND is_deleted = false) AS following_count`,
      [user.id]
    );
    const followersCount = Number(counts.rows[0]?.followers_count ?? 0);
    const followingCount = Number(counts.rows[0]?.following_count ?? 0);
    const nameParts = [user.first_name, user.last_name].filter(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: nameParts.join(" ").trim(),
        firstName: user.first_name,
        lastName: user.last_name,
        userName: user.user_name,
        email: user.email,
        photo: user.photo,
        bio: user.bio,
        interests: user.interests ?? [],
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        lastLocationUpdate: user.last_location_update,
        followersCount,
        followingCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message ?? error?.toString() });
  }
};

export const updateLocation = async (req: Request, res: Response) => {
  const { latitude, longitude, force, ...rest } = req.body as {
    latitude: number;
    longitude: number;
    force?: boolean;
  };

  const extraFields = Helpers.noExtraFields(rest);
  if (!extraFields.success) {
    return res.status(400).json({ message: extraFields.message });
  }

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({
      message: "latitude and longitude must be numbers.",
    });
  }

  try {
    const userId = req.user;
    const existing = await pool.query(
      "SELECT address, city, state, country, last_location_update FROM clients WHERE id = $1 AND is_deleted = false",
      [userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const lastUpdate = existing.rows[0].last_location_update as Date | null;
    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    if (!force && lastUpdate) {
      const delta = now.getTime() - new Date(lastUpdate).getTime();
      if (delta < thirtyDaysMs) {
        return res.status(200).json({
          success: true,
          skipped: true,
          data: {
            address: existing.rows[0].address,
            city: existing.rows[0].city,
            state: existing.rows[0].state,
            country: existing.rows[0].country,
            lastLocationUpdate: existing.rows[0].last_location_update,
          },
        });
      }
    }

    const location = await reverseGeocode(latitude, longitude);

    const result = await pool.query(
      `UPDATE clients
       SET address = $1,
           city = $2,
           state = $3,
           country = $4,
           last_location_update = CURRENT_TIMESTAMP,
           modified_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING address, city, state, country, last_location_update`,
      [
        location.address,
        location.city,
        location.state,
        location.country ?? "nigeria",
        userId,
      ]
    );

    return res.status(200).json({
      success: true,
      skipped: false,
      data: {
        address: result.rows[0].address,
        city: result.rows[0].city,
        state: result.rows[0].state,
        country: result.rows[0].country,
        lastLocationUpdate: result.rows[0].last_location_update,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message ?? error?.toString() });
  }
};

export const getUserProfileById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const viewerId = req.user;

  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, user_name, email, photo, bio, interests,
              address, city, state, country,
              (SELECT COUNT(*) FROM followers WHERE influencer = clients.id AND is_deleted = false) AS followers_count,
              (SELECT COUNT(*) FROM followers WHERE follower = clients.id AND is_deleted = false) AS following_count,
              (SELECT EXISTS(
                SELECT 1 FROM followers 
                WHERE influencer = clients.id AND follower = $2 AND is_deleted = false
              )) AS is_following
       FROM clients WHERE id = $1 AND is_deleted = false`,
      [id, viewerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = result.rows[0];
    const nameParts = [user.first_name, user.last_name].filter(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: nameParts.join(" ").trim(),
        firstName: user.first_name,
        lastName: user.last_name,
        userName: user.user_name,
        email: user.email,
        photo: user.photo,
        bio: user.bio,
        interests: user.interests ?? [],
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        followersCount: Number(user.followers_count ?? 0),
        followingCount: Number(user.following_count ?? 0),
        isFollowing: user.is_following === true,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message ?? error?.toString() });
  }
};

export const followUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const followerId = req.user;

  if (id === followerId) {
    return res.status(400).json({ message: "You cannot follow yourself." });
  }

  try {
    const userCheck = await pool.query(
      "SELECT id FROM clients WHERE id = $1 AND is_deleted = false",
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const existing = await pool.query(
      "SELECT id, is_deleted FROM followers WHERE influencer = $1 AND follower = $2",
      [id, followerId]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].is_deleted) {
        await pool.query(
          "UPDATE followers SET is_deleted = false WHERE id = $1",
          [existing.rows[0].id]
        );
      }
      return res.status(200).json({ success: true, following: true });
    }

    await pool.query(
      "INSERT INTO followers(influencer, follower) VALUES($1, $2)",
      [id, followerId]
    );

    return res.status(200).json({ success: true, following: true });
  } catch (error) {
    return res.status(500).json({ message: error?.message ?? error?.toString() });
  }
};

export const unfollowUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const followerId = req.user;

  if (id === followerId) {
    return res.status(400).json({ message: "You cannot unfollow yourself." });
  }

  try {
    const result = await pool.query(
      "UPDATE followers SET is_deleted = true WHERE influencer = $1 AND follower = $2 AND is_deleted = false RETURNING id",
      [id, followerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Follow relationship not found." });
    }

    return res.status(200).json({ success: true, following: false });
  } catch (error) {
    return res.status(500).json({ message: error?.message ?? error?.toString() });
  }
};


export const getRegimesByCreator = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = "1", limit = "20", participant = "false" } = req.query;

    if (isNaN(Number(page)) || isNaN(Number(limit))) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be numeric values.",
      });
    }

    if (!["true", "false"].includes(String(participant))) {
      return res.status(400).json({
        success: false,
        message: 'participant must be either "true" or "false".',
      });
    }

    const isParticipant = String(participant) === "true";
    const offset = (Number(page) - 1) * Number(limit);
    const values: any[] = [id, Number(limit), offset];

    const query = `
      SELECT 
          r.id,
          r.name,
          r.type,
          r.creator_id,
          c.user_name AS creator_user_name,
          c.photo AS creator_photo,
          ${isParticipant ? "rp.participant_role" : "NULL::text"} AS participant_role,
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
      ${
        isParticipant
          ? "JOIN regime_participant rp ON rp.regime_id = r.id AND rp.participant_id = $1 AND rp.is_deleted = false AND LOWER(rp.participant_role) != 'creator'"
          : ""
      }
      WHERE ${isParticipant ? "r.is_deleted = false" : "r.creator_id = $1 AND r.is_deleted = false"}
      GROUP BY r.id, c.id${isParticipant ? ", rp.participant_role" : ""}
      ORDER BY r.created_at DESC
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

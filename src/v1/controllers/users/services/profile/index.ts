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
              address, city, state, country, last_location_update
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

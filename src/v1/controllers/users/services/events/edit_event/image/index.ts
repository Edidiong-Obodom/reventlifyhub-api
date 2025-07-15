import { Request, Response } from "express";
import * as Helpers from "../../../../../../../helpers/index";
import Log from "../../../../../../../utilities/logger";
import cloudinary from "../../../../../../../utilities/cloudinary";
import { pool } from "../../../../../../../db";

export const regimeImageEdit = async (req: Request, res: Response) => {
  const { user } = req;
  const data = JSON.stringify(req.body);
  const requiredHeaders = Helpers.requiredFields(req.body, [
    "regimeId",
    "image",
  ]);
  if (!requiredHeaders.success) {
    req.auditData = {
      action: "Regime Edit: Image",
      details: requiredHeaders.message,
    };
    return res.status(400).json({
      message: requiredHeaders.message,
    });
  }
  const { regimeId, image } = req.body;

  await pool.query("BEGIN");
  try {
    const regimeDetails = await Helpers.getData("regimes", "id", regimeId);

    if (regimeDetails.rowCount === 0) {
      req.auditData = {
        action: "Regime Edit: Image",
        details: "Regime does not exist",
      };
      return res.status(404).json({
        message: "Regime does not exist",
      });
    }

    if (regimeDetails.rows[0].creator_id !== user) {
      req.auditData = {
        action: "Regime Edit: Image",
        details: "You are not authorized to edit this regime",
      };
      return res.status(403).json({
        message: "You are not authorized to edit this regime",
      });
    }

    const details = Helpers.sizeChecker(image);
    if (details.MB > 10) {
      req.auditData = {
        action: "Regime Edit: Image",
        details: "Media larger than 10MB",
      };
      return res.status(400).json({
        message: "Media larger than 10MB",
      });
    }

    const resultOfUpdate = await cloudinary.uploader.upload(image, {
      folder: "regime_media",
    });

    const updateImage = await pool.query(
      "UPDATE regimes SET media = $1, media_id = $2, modified_at = CURRENT_TIMESTAMP WHERE id = $3",
      [resultOfUpdate.secure_url, resultOfUpdate.public_id, regimeId]
    );

    if (updateImage.rowCount === 1) {
      await pool.query("COMMIT");
      req.auditData = {
        action: "Regime Edit: Image",
        details: "1 record updated successfully",
      };
      return res.status(200).json({
        message: "1 record updated successfully",
      });
    } else {
      await pool.query("ROLLBACK");
      return res.status(200).json({
        message: `0 record(s) updated successfully.`,
      });
    }
  } catch (error) {
    await pool.query("ROLLBACK");
    req.auditData = {
      action: "Regime Edit: Image",
      details: error?.message ?? error.toString(),
    };
    return res.status(200).json({
      message: "Oops something went wrong...",
    });
  }
};

import { Response } from "express";
import { ExtendedRequest } from "../../../../../../../utilities/authenticateToken/authenticateToken.dto";
import * as Helpers from "../../../../../../../helpers/index";
import Log from "../../../../../../../utilities/logger";
import cloudinary from "../../../../../../../utilities/cloudinary";
import { pool } from "../../../../../../../db";

export const regimeImageEdit = async (req: ExtendedRequest, res: Response) => {
  const { user } = req;
  const data = JSON.stringify(req.body);
  const requiredHeaders = Helpers.requiredFields(req.body, [
    "regimeId",
    "image",
  ]);
  if (!requiredHeaders.success) {
    return await Log.eventEditLogs(
      { req, res, endPoint: "v1/user/regime/edit/image" },
      {
        actorId: user,
        actor: req.email,
        action: "Regime Edit: Image",
        eventId: "",
        eventName: null,
        data,
        status: "Failed",
        details: requiredHeaders.message,
      }
    );
  }
  const { regimeId, image } = req.body;

  await pool.query("BEGIN");
  try {
    const regimeDetails = await Helpers.getData("regimes", "id", regimeId);

    if (regimeDetails.rowCount === 0) {
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit/image" },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit: Image",
          eventId: "",
          eventName: null,
          data,
          status: "Failed",
          details: "Regime does not exist",
        }
      );
    }

    if (regimeDetails[0].creator_id !== user) {
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit/image", logStatusCode: 403 },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit: Image",
          eventId: regimeId,
          eventName: regimeDetails[0].name,
          data,
          status: "Failed",
          details: "You are not authorized to edit this regime",
        }
      );
    }

    const details = Helpers.sizeChecker(image);
    if (details.MB > 10) {
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit/image" },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit: Image",
          eventId: regimeId,
          eventName: regimeDetails[0].name,
          data,
          status: "Failed",
          details: "Media larger than 10MB",
        }
      );
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
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit/image" },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit: Image",
          eventId: regimeId,
          eventName: regimeDetails[0].name,
          data,
          status: "Success",
          details: "1 record updated successfully",
        }
      );
    } else {
      await pool.query("ROLLBACK");
      return res.status(200).json({
        message: `0 record(s) updated successfully.`,
      });
    }
  } catch (error) {
    await pool.query("ROLLBACK");
    return await Log.eventEditLogs(
      { req, res, endPoint: "v1/user/regime/edit/image", logStatusCode: 500 },
      {
        actorId: user,
        actor: req.email,
        action: "Regime Edit: Image",
        eventId: "",
        eventName: null,
        data,
        status: "Failed",
        details: "Oops something went wrong...",
        error: error?.message ?? JSON.stringify(error),
      }
    );
  }
};

import { Response } from "express";
import { ExtendedRequest } from "../../../../../../utilities/authenticateToken/authenticateToken.dto";
import { pool } from "../../../../../../db";
import * as Helper from "../../../../../../helpers/index";
import { CreateRegimeType } from "../create_events/create_events_types";
import Log from "../../../../../../utilities/logger";

// Edit Regime
export const editRegime = async (req: ExtendedRequest, res: Response) => {
  const { user } = req;
  const currentDate = new Date();

  const headers = ["regime_id"];

  // check data for each field in the request query param and validate format
  const requiredHeaders = Helper.requiredFields(req.headers, headers, "Header");

  if (!requiredHeaders.success) {
    return res.status(400).json({ message: requiredHeaders.message });
  }
  const { regime_id } = req.headers; // Get regime ID from route parameter

  if (typeof regime_id !== "string") {
    return res
      .status(400)
      .json({ message: "regime_id header must be a string" });
  }

  const {
    regimeName,
    regimeAddress,
    regimeCity,
    regimeState,
    regimeCountry,
    regimeDescription,
    regimeType,
    regimeStartDate,
    regimeStartTime,
    regimeEndDate,
    regimeEndTime,
    ...rest
  } = req.body as Partial<CreateRegimeType>;

  const data = JSON.stringify({
    regimeName,
    regimeAddress,
    regimeCity,
    regimeState,
    regimeCountry,
    regimeDescription,
    regimeType,
    regimeStartDate,
    regimeStartTime,
    regimeEndDate,
    regimeEndTime,
  });

  // Check if there are any additional properties in the request body
  const extraFields = Helper.noExtraFields(rest);
  if (!extraFields.success) {
    return await Log.eventEditLogs(
      { req, res, endPoint: "v1/user/regime/edit" },
      {
        actorId: user,
        actor: req.email,
        action: "Regime Edit",
        eventId: regime_id,
        eventName: regimeName,
        data,
        status: "Failed",
        details: extraFields.message,
        date: currentDate,
      }
    );
  }

  try {
    // Check if the regime exists and belongs to the current user
    const regimeResult = await Helper.getData_CustomOperation(
      "regimes",
      ["id", "creator_id"],
      [regime_id, user],
      { ins: ["=", "="], between: ["AND"] }
    );

    if (regimeResult.rowCount === 0) {
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit", logStatusCode: 404 },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit",
          eventId: regime_id,
          eventName: regimeName,
          data,
          status: "Failed",
          details: "Regime not found.",
          date: currentDate,
        }
      );
    }

    // Date validation section
    if (
      !Helper.allowedDateFormat.test(regimeStartDate) ||
      !Helper.allowedDateFormat.test(regimeEndDate) ||
      !Helper.februaryCheck(regimeStartDate) ||
      !Helper.februaryCheck(regimeEndDate)
    ) {
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit" },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit",
          eventId: regime_id,
          eventName: regimeName,
          data,
          status: "Failed",
          details:
            "Your endDate or startDate must match the YYYY-MM-DD format i.e 2023-05-19",
          date: currentDate,
        }
      );
    }

    const start = new Date(regimeStartDate);
    const end = new Date(regimeEndDate);
    if (currentDate > start || currentDate > end) {
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit" },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit",
          eventId: regime_id,
          eventName: regimeName,
          data,
          status: "Failed",
          details:
            "Your event startDate or endDate must not be a day or more behind the current date",
          date: currentDate,
        }
      );
    }

    // Time validation section
    if (
      !Helper.allowedTimeFormat.test(regimeStartTime) ||
      !Helper.allowedTimeFormat.test(regimeEndTime)
    ) {
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit" },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit",
          eventId: regime_id,
          eventName: regimeName,
          data,
          status: "Failed",
          details:
            "Your endTime or startTime must match the HH:MM:SS 24hrs format i.e 23:04:00",
          date: currentDate,
        }
      );
    }

    // Date and Time final validation section
    const finalStart = new Date(regimeStartDate + " " + regimeStartTime);
    const finalEnd = new Date(regimeEndDate + " " + regimeEndTime);

    if (finalStart > finalEnd) {
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit" },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit",
          eventId: regime_id,
          eventName: regimeName,
          data,
          status: "Failed",
          details:
            "Your startTime and startDate cannot be greater than your endDate and endTime.",
          date: currentDate,
        }
      );
    }

    // Build dynamic query for updates
    const fieldsToUpdate = [];
    const values = [];

    if (regimeName) {
      fieldsToUpdate.push("name = $1");
      values.push(regimeName);
    }
    if (regimeAddress) {
      fieldsToUpdate.push("address = $" + (values.length + 1));
      values.push(regimeAddress);
    }
    if (regimeCity) {
      fieldsToUpdate.push("city = $" + (values.length + 1));
      values.push(regimeCity);
    }
    if (regimeState) {
      fieldsToUpdate.push("state = $" + (values.length + 1));
      values.push(regimeState);
    }
    if (regimeCountry) {
      fieldsToUpdate.push("country = $" + (values.length + 1));
      values.push(regimeCountry);
    }
    if (regimeDescription) {
      fieldsToUpdate.push("description = $" + (values.length + 1));
      values.push(regimeDescription);
    }
    if (regimeType) {
      const regimeTypeValid = Helper.isValidRegimeType(regimeType);

      // Check if regimeType is valid
      if (!regimeTypeValid.status) {
        return await Log.eventEditLogs(
          { req, res, endPoint: "v1/user/regime/edit" },
          {
            actorId: user,
            actor: req.email,
            action: "Regime Edit",
            eventId: regime_id,
            eventName: regimeName,
            data,
            status: "Failed",
            details: regimeTypeValid.message,
            date: currentDate,
          }
        );
      }

      fieldsToUpdate.push("type = $" + (values.length + 1));
      values.push(regimeType);
    }
    if (regimeStartDate) {
      fieldsToUpdate.push("start_date = $" + (values.length + 1));
      values.push(regimeStartDate);
    }
    if (regimeStartTime) {
      fieldsToUpdate.push("start_time = $" + (values.length + 1));
      values.push(regimeStartTime);
    }
    if (regimeEndDate) {
      fieldsToUpdate.push("end_date = $" + (values.length + 1));
      values.push(regimeEndDate);
    }
    if (regimeEndTime) {
      fieldsToUpdate.push("end_time = $" + (values.length + 1));
      values.push(regimeEndTime);
    }

    // Add modified_at to track updates
    fieldsToUpdate.push("modified_at = $" + (values.length + 1));
    values.push(new Date());

    // Build the final query
    const updateQuery = `
      UPDATE regimes
      SET ${fieldsToUpdate.join(", ")}
      WHERE id = $${values.length + 1}
      RETURNING *;
    `;
    values.push(regime_id);

    // Execute the update query
    const updateResult = await pool.query(updateQuery, values);

    if (updateResult.rowCount === 0) {
      return await Log.eventEditLogs(
        { req, res, endPoint: "v1/user/regime/edit", logStatusCode: 500 },
        {
          actorId: user,
          actor: req.email,
          action: "Regime Edit",
          eventId: regime_id,
          eventName: regimeName,
          data,
          status: "Failed",
          details: "Failed to update regime.",
          date: currentDate,
        }
      );
    }

    return await Log.eventEditLogs(
      {
        req,
        res,
        endPoint: "v1/user/regime/edit",
        logResponse: {
          message: "Regime updated successfully.",
          data: updateResult.rows[0],
        },
      },
      {
        actorId: user,
        actor: req.email,
        action: "Regime Edit",
        eventId: regime_id,
        eventName: regimeName,
        data,
        status: "Success",
        details: "Failed to update regime.",
        date: currentDate,
      }
    );
  } catch (error) {
    console.error("Error updating regime:", error);
    return await Log.eventEditLogs(
      { req, res, endPoint: "v1/user/regime/edit", logStatusCode: 500 },
      {
        actorId: user,
        actor: req.email,
        action: "Regime Edit",
        eventId: regime_id,
        eventName: regimeName,
        data,
        status: "Failed",
        details: error?.message ?? "Error updating regime",
        date: currentDate,
        error: JSON.stringify(error),
      }
    );
  }
};

import { Request, Response } from "express";
import { pool } from "../../../../../../db";
import * as Helpers from "../../../../../../helpers/index";
import { CreateRegimeType } from "../create_events/create_events_types";
import Log from "../../../../../../utilities/logger";

// edit regime image
export * from "./image";

// Edit Regime
export const editRegime = async (req: Request, res: Response) => {
  const { user } = req;
  const currentDate = new Date();

  // Validate request
  const validation = validateEditRegimeRequest(req);

  const regime_id = req.headers.regime_id as string;
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

  if (!validation.success) {
    req.auditData = {
      action: "Regime Edit",
      details: validation.message,
    };
    return res.status(400).json({ message: validation.message });
  }

  try {
    // Check if the regime exists and belongs to the current user
    const regimeResult = await Helpers.getData_CustomOperation(
      "regimes",
      ["id", "creator_id"],
      [regime_id, user],
      { ins: ["=", "="], between: ["AND"] }
    );

    if (regimeResult.rowCount === 0) {
      req.auditData = {
        action: "Regime Edit",
        details: "Regime not found.",
      };
      return res.status(404).json({ message: "Regime not found." });
    }

    // Build dynamic query for updates
    const fieldsToUpdate = [];
    const values = [];

    if (regimeName) {
      // if (Helpers.characters_not_allowed_for_regime_naming.test(regimeName)) {
      //   return await Log.eventEditLogs(
      //     { req, res, endPoint: "v1/user/regime/edit" },
      //     {
      //       actorId: user,
      //       actor: req.email,
      //       action: "Regime Edit",
      //       eventId: regime_id,
      //       eventName: regimeResult.rows[0].name,
      //       data,
      //       status: "Failed",
      //       details:
      //         "Regime name with any of these special characters are not allowed: {}<>",
      //     }
      //   );
      // } else {
      fieldsToUpdate.push("name = $1");
      values.push(regimeName);
      // }
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
      const regimeTypeValid = Helpers.isValidRegimeType(regimeType);

      // Check if regimeType is valid
      if (!regimeTypeValid.status) {
        req.auditData = {
          action: "Regime Edit",
          details: regimeTypeValid.message,
        };
        return res.status(400).json({ message: regimeTypeValid.message });
      }

      fieldsToUpdate.push("type = $" + (values.length + 1));
      values.push(regimeType);
    }

    if (regimeStartDate && regimeStartTime && regimeEndDate && regimeEndTime) {
      // Date validation section
      if (
        !Helpers.allowedDateFormat.test(regimeStartDate) ||
        !Helpers.allowedDateFormat.test(regimeEndDate) ||
        !Helpers.februaryCheck(regimeStartDate) ||
        !Helpers.februaryCheck(regimeEndDate)
      ) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your endDate or startDate must match the YYYY-MM-DD format i.e 2023-05-19",
        };
        return res.status(400).json({
          message:
            "Your endDate or startDate must match the YYYY-MM-DD format i.e 2023-05-19",
        });
      }

      const start = new Date(regimeStartDate);
      const end = new Date(regimeEndDate);
      if (currentDate > start || currentDate > end) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your event startDate or endDate must not be a day or more behind the current date",
        };
        return res.status(400).json({
          message:
            "Your event startDate or endDate must not be a day or more behind the current date",
        });
      }

      // Time validation section
      if (
        !Helpers.allowedTimeFormat.test(regimeStartTime) ||
        !Helpers.allowedTimeFormat.test(regimeEndTime)
      ) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your endTime or startTime must match the HH:MM:SS 24hrs format i.e 23:04:00",
        };
        return res.status(400).json({
          message:
            "Your endTime or startTime must match the HH:MM:SS 24hrs format i.e 23:04:00",
        });
      }

      // Date and Time final validation section
      const finalStart = new Date(regimeStartDate + " " + regimeStartTime);
      const finalEnd = new Date(regimeEndDate + " " + regimeEndTime);

      if (finalStart > finalEnd) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your startTime and startDate cannot be greater than your endDate and endTime.",
        };
        return res.status(400).json({
          message:
            "Your startTime and startDate cannot be greater than your endDate and endTime.",
        });
      }

      fieldsToUpdate.push("start_date = $" + (values.length + 1));
      values.push(regimeStartDate);
      fieldsToUpdate.push("start_time = $" + (values.length + 1));
      values.push(regimeStartTime);
      fieldsToUpdate.push("end_date = $" + (values.length + 1));
      values.push(regimeEndDate);
      fieldsToUpdate.push("end_time = $" + (values.length + 1));
      values.push(regimeEndTime);
    } else if (
      regimeStartDate ||
      regimeStartTime ||
      regimeEndDate ||
      regimeEndTime
    ) {
      const start_date = {
        value: regimeResult.rows[0].start_date,
        date: new Date(regimeResult.rows[0].start_date),
      };
      let start_time = regimeResult.rows[0].start_time;
      const end_date = {
        value: regimeResult.rows[0].end_date,
        date: new Date(regimeResult.rows[0].end_date),
      };
      let end_time = regimeResult.rows[0].end_time;

      // Handle startDate
      if (
        regimeStartDate &&
        (!Helpers.allowedDateFormat.test(regimeStartDate) ||
          !Helpers.februaryCheck(regimeStartDate))
      ) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your startDate must match the YYYY-MM-DD format i.e 2023-05-19",
        };
        return res.status(400).json({
          message:
            "Your startDate must match the YYYY-MM-DD format i.e 2023-05-19",
        });
      } else if (regimeStartDate) {
        start_date.value = regimeStartDate;
        start_date.date = new Date(regimeStartDate);
        fieldsToUpdate.push("start_date = $" + (values.length + 1));
        values.push(regimeStartDate);
      }

      // Handle startTime
      if (regimeStartTime && !Helpers.allowedTimeFormat.test(regimeStartTime)) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your startTime must match the HH:MM:SS 24hrs format i.e 23:04:00",
        };
        return res.status(400).json({
          message:
            "Your startTime must match the HH:MM:SS 24hrs format i.e 23:04:00",
        });
      } else if (regimeStartTime) {
        start_time = regimeStartTime;
        fieldsToUpdate.push("start_time = $" + (values.length + 1));
        values.push(regimeStartTime);
      }

      // Handle endtime
      if (
        regimeEndDate &&
        (!Helpers.allowedDateFormat.test(regimeEndDate) ||
          !Helpers.februaryCheck(regimeEndDate))
      ) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your endDate must match the YYYY-MM-DD format i.e 2023-05-19",
        };
        return res.status(400).json({
          message:
            "Your endDate must match the YYYY-MM-DD format i.e 2023-05-19",
        });
      } else if (regimeEndDate) {
        end_date.value = regimeEndDate;
        end_date.date = new Date(regimeEndDate);
        fieldsToUpdate.push("end_date = $" + (values.length + 1));
        values.push(regimeEndDate);
      }

      // Handle endTime
      if (regimeEndTime && !Helpers.allowedTimeFormat.test(regimeEndTime)) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your startTime must match the HH:MM:SS 24hrs format i.e 23:04:00",
        };
        return res.status(400).json({
          message:
            "Your startTime must match the HH:MM:SS 24hrs format i.e 23:04:00",
        });
      } else if (regimeEndTime) {
        end_time = regimeEndTime;
        fieldsToUpdate.push("end_time = $" + (values.length + 1));
        values.push(regimeEndTime);
      }

      if (currentDate > start_date.date || currentDate > end_date.date) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your event startDate or endDate must not be a day or more behind the current date",
        };
        return res.status(400).json({
          message:
            "Your event startDate or endDate must not be a day or more behind the current date",
        });
      }

      // Date and Time final validation section
      const finalStart = new Date(start_date.value + " " + start_time);
      const finalEnd = new Date(end_date.value + " " + end_time);

      if (finalStart > finalEnd) {
        req.auditData = {
          action: "Regime Edit",
          details:
            "Your startTime and startDate cannot be greater than your endDate and endTime.",
        };
        return res.status(400).json({
          message:
            "Your startTime and startDate cannot be greater than your endDate and endTime.",
        });
      }
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

    if (values.length > 2) {
      // Execute the update query
      const updateResult = await pool.query(updateQuery, values);

      if (updateResult.rowCount === 0) {
        req.auditData = {
          action: "Regime Edit",
          details: "Failed to update regime.",
        };
        return res.status(400).json({
          message: "Failed to update regime.",
        });
      }

      delete updateResult.rows[0].withdrawal_pin;
      delete updateResult.rows[0].media;
      delete updateResult.rows[0].media_id;
      delete updateResult.rows[0].balance;
      delete updateResult.rows[0].affiliate;
      delete updateResult.rows[0].status;

      req.auditData = {
        action: "Regime Edit",
        details: "Regime updated successfully.",
      };
      return res.status(200).json({
        message: "Regime updated successfully.",
      });
    } else {
      req.auditData = {
        action: "Regime Edit",
        details: "You did not pass any value to update.",
      };
      return res.status(400).json({
        message: "You did not pass any value to update.",
      });
    }
  } catch (error) {
    req.auditData = {
      action: "Regime Edit",
      details: error?.message ?? error?.toString() ?? "Error updating regime",
    };
    return res.status(500).json({
      message: "Error updating regime",
    });
  }
};

const validateEditRegimeRequest = (
  req: Request
): { success: boolean; message?: string } => {
  const requiredHeaders = Helpers.requiredFields(
    req.headers,
    ["regime_id"],
    "Header"
  );
  if (!requiredHeaders.success) {
    return { success: false, message: requiredHeaders.message };
  }

  if (typeof req.headers.regime_id !== "string") {
    return { success: false, message: "regime_id header must be a string" };
  }

  // Add more validation logic here if needed
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

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);
  if (!extraFields.success) {
    return { success: false, message: extraFields.message };
  }
  return { success: true };
};

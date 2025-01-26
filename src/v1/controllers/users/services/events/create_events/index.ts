import { Response } from "express";
import { pool } from "../../../../../../db";
import { ExtendedRequest } from "../../../../../../utilities/authenticateToken/authenticateToken.dto";
import * as Helpers from "../../../../../../helpers";
import * as nodemailer from "nodemailer";
import * as bcrypt from "bcrypt";
import cloudinary from "../../../../../../utilities/cloudinary";
import { CreateRegimeType } from "./create_events_types";
import moment from "moment";
import { getClientIp } from "../../../../../../utilities/logger/allLogs";
import Log from "../../../../../../utilities/logger";

// Check for regime name availability
export const nameAvailability = async (req: ExtendedRequest, res: Response) => {
  const field = ["regimeName"];
  const currentDate = new Date();
  const { ip, ipLookUp } = await getClientIp(req);

  // check data for each field in the request query param and validate format
  const requiredFields = Helpers.requiredFields(
    req.query,
    field,
    "Query param"
  );

  if (!requiredFields.success) {
    return res.status(400).json({ message: requiredFields.message });
  }
  const { regimeName, ...rest } = req.query as { regimeName: string };

  // Check if there are any additional properties in the request query param
  const extraFields = Helpers.noExtraFields(rest, "Query param");

  if (!extraFields.success) {
    await Log.auditLogs({
      user: req.email,
      action: "Regime Name Availability",
      details: extraFields.message,
      endPoint: "v1/user/regime/name/availability",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: extraFields.message });
  }

  const user = req.user;

  try {
    if (regimeName.length === 0)
      res.status(400).json({ message: "Regime name can not be empty." });

    if (Helpers.characters_not_allowed_for_regime_naming.test(regimeName)) {
      return res.status(400).json({
        message:
          "Regime name with any of these special characters are not allowed: {}<>",
      });
    }

    const nameCheck = await pool.query(
      "SELECT * FROM regimes WHERE name ILIKE $1",
      [regimeName.trim()]
    );

    if (nameCheck.rows.length > 0) {
      const currentDate = new Date();
      const endDateFormatted = moment(nameCheck.rows[0].end_date).format(
        "YYYY-MM-DD"
      );
      const endDate = new Date(
        endDateFormatted + " " + nameCheck.rows[0].end_time
      );
      const nameCheck1 = await pool.query(
        "SELECT * FROM regimes WHERE name ILIKE $1 and creator_id = $2",
        [regimeName.trim(), user]
      );

      if (nameCheck1.rows.length === 0) {
        await Log.auditLogs({
          user: req.email,
          action: "Regime Name Availability",
          details: "Regime name already in use by another creator",
          endPoint: "v1/user/regime/name/availability",
          date: currentDate,
          metaData: {
            ipAddress: ip,
            location: ipLookUp,
          },
        });
        return res
          .status(409)
          .json({ message: "Regime name already in use by another creator" });
      } else if (nameCheck1.rows.length > 0 && currentDate < endDate) {
        await Log.auditLogs({
          user: req.email,
          action: "Regime Name Availability",
          details: `Your regime ${nameCheck1.rows[0].name} is still ongoing, you can't create another with the same name until the current regime ends. `,
          endPoint: "v1/user/regime/name/availability",
          date: currentDate,
          metaData: {
            ipAddress: ip,
            location: ipLookUp,
          },
        });
        return res.status(409).json({
          message: `Your regime ${nameCheck1.rows[0].name} is still ongoing, you can't create another with the same name until the current regime ends. `,
        });
      } else {
        await Log.auditLogs({
          user: req.email,
          action: "Regime Name Availability",
          details: `success`,
          endPoint: "v1/user/regime/name/availability",
          date: currentDate,
          metaData: {
            ipAddress: ip,
            location: ipLookUp,
          },
        });
        return res.status(200).json({ message: "Regime name is free for use" });
      }
    }
    await Log.auditLogs({
      user: req.email,
      action: "Regime Name Availability",
      details: "Regime name does not exist",
      endPoint: "v1/user/regime/name/availability",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(200).json({ message: "Regime name does not exist" });
  } catch (error) {
    await Log.auditLogs({
      user: req.email,
      action: "Regime Name Availability",
      details: error.message,
      endPoint: "v1/user/regime/name/availability",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(500).json({ message: "Oops something went wrong..." });
  }
};

// Create regime
export const createRegime = async (req: ExtendedRequest, res: Response) => {
  const userId = req.user;
  const email = req.email;
  const currentDate = new Date();
  const { ip, ipLookUp } = await getClientIp(req);
  let userName = null;

  const userData = await Helpers.findUserById(userId);
  userName = userData.rows[0].user_name;

  const fields = [
    "regimeName",
    "regimeType",
    "regimeDescription",
    "regimeAddress",
    "regimePricing",
    "regimeCity",
    "regimeState",
    "regimeCountry",
    "regimeWithdrawalPin",
    "regimeMediaBase64",
    "regimeStartDate",
    "regimeStartTime",
    "regimeEndDate",
    "regimeEndTime",
  ];

  // check data for each field in the body and validate format
  const fieldCheck = Helpers.requiredFields(req.body, fields);

  if (!fieldCheck.success)
    return res.status(400).json({ message: fieldCheck.message });

  const {
    regimeName,
    regimeType,
    regimeDescription,
    regimeAddress,
    regimePricing,
    regimeCity,
    regimeState,
    regimeCountry,
    regimeWithdrawalPin,
    regimeMediaBase64,
    regimeAffiliate,
    regimeStartDate,
    regimeStartTime,
    regimeEndDate,
    regimeEndTime,
    ...rest
  } = req.body as CreateRegimeType;

  const regimeTypeValid = Helpers.isValidRegimeType(regimeType);

  // Check if regimeType is valid
  if (!regimeTypeValid.status) {
    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details: regimeTypeValid.message,
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: regimeTypeValid.message });
  }

  // Date validation section
  if (
    !Helpers.allowedDateFormat.test(regimeStartDate) ||
    !Helpers.allowedDateFormat.test(regimeEndDate) ||
    !Helpers.februaryCheck(regimeStartDate) ||
    !Helpers.februaryCheck(regimeEndDate)
  ) {
    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details:
        "Your endDate or startDate must match the YYYY-MM-DD format i.e 2023-05-19",
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({
      message:
        "Your endDate or startDate must match the YYYY-MM-DD format i.e 2023-05-19",
    });
  }

  const start = new Date(regimeStartDate);
  const end = new Date(regimeEndDate);
  if (currentDate > start || currentDate > end) {
    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details:
        "Your event startDate or endDate must not be a day or more behind the current date",
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
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
    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details:
        "Your endTime or startTime must match the HH:MM:SS 24hrs format i.e 23:04:00",
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({
      message:
        "Your endTime or startTime must match the HH:MM:SS 24hrs format i.e 23:04:00",
    });
  }

  // Date and Time final validation section
  const finalStart = new Date(regimeStartDate + " " + regimeStartTime);
  const finalEnd = new Date(regimeEndDate + " " + regimeEndTime);

  if (finalStart > finalEnd) {
    return res.status(400).json({
      message:
        "Your startTime and startDate cannot be greater than your endDate and endTime.",
    });
  }

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details: extraFields.message,
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: extraFields.message });
  }

  const pricingFields = [
    "pricingName",
    "pricingTotalSeats",
    // "pricingAmount",
    // "pricingAffiliateAmount",
  ];

  const pricingValidationResult: string[] = [];

  // checks to see if all the regime's pricing matches the required format
  if (regimePricing.length > 10) {
    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details: "You cannot have more than 10 pricings for one event.",
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({
      message: "You cannot have more than 10 pricings for one event.",
    });
  }

  // checks to see if all the regime's pricing matches the required format
  if (regimePricing.length === 0) {
    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details:
        "You cannot have 0 pricings for an event, even if it's a free event make one pricing and make the pricing amount 0.",
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({
      message:
        "You cannot have 0 pricings for an event, even if it's a free event make one pricing and make the pricing amount 0.",
    });
  }

  regimePricing.map(async (price, i) => {
    const pricingFieldCheck = Helpers.requiredFields(
      price,
      pricingFields,
      "body: pricingFields"
    );
    if (!pricingFieldCheck.success) {
      pricingValidationResult.push(
        Helpers.pricingErrorMessage(pricingFieldCheck.message, i)
      );
    }

    if (
      regimeAffiliate &&
      (!price.pricingAmount ||
        !price.pricingAffiliateAmount ||
        price.pricingAmount < 1000 ||
        price.pricingAffiliateAmount < 100)
    ) {
      pricingValidationResult.push(
        "Pricing amount cannot be lesser than 1000, and affiliate amount cannot be lesser than 100 when affiliate is true. Check pricing number " +
          Number(i + 1)
      );
    }

    if (!regimeAffiliate && price.pricingAffiliateAmount) {
      pricingValidationResult.push(
        "Pricing can't have pricingAffiliateAmount when regimeAffiliate is false"
      );
    }
  });

  if (pricingValidationResult.length > 0) {
    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details: pricingValidationResult[0],
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({
      message: pricingValidationResult[0],
    });
  }

  // Then do this if all validations pass
  try {
    // checks for name availability
    const nameCheckResult = await Helpers.regimeNameCheck(
      userId,
      regimeName.trim()
    );

    if (!nameCheckResult) {
      await Log.auditLogs({
        user: req.email,
        action: "Regime Create",
        details: "Regime name already in use.",
        endPoint: "v1/user/regime/create",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(409).json({ message: "Regime name already in use." });
    }

    // Checks media file size
    if (Helpers.sizeChecker(regimeMediaBase64).MB > 10) {
      await Log.auditLogs({
        user: req.email,
        action: "Regime Create",
        details: "Media larger than 10MB",
        endPoint: "v1/user/regime/create",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json("Media larger than 10MB");
    }
    // Use Promise.all for Concurrent Operations
    const [hashedPin, resultOfUpdate] = await Promise.all([
      bcrypt.hash(regimeWithdrawalPin, 10),
      cloudinary.uploader.upload(regimeMediaBase64, { folder: "regime_media" }),
    ]);

    await pool.query("BEGIN");
    // creates the regime
    const newRegime = await pool.query(
      `INSERT INTO regimes(
        creator_id, name, address, city, state, country, withdrawal_pin, type, 
        media, media_id, balance, affiliate, status, start_date, start_time, 
        end_date, end_time, description) 
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
        $16, $17, $18) RETURNING *`,
      [
        userId,
        regimeName.trim(),
        regimeAddress,
        regimeCity.toLowerCase(),
        regimeState.toLowerCase(),
        regimeCountry.toLowerCase(),
        hashedPin,
        regimeType.toLowerCase(),
        resultOfUpdate.secure_url,
        resultOfUpdate.public_id,
        0.0,
        regimeAffiliate,
        "pending",
        regimeStartDate,
        regimeStartTime,
        regimeEndDate,
        regimeEndTime,
        regimeDescription,
      ]
    );

    // creates all the regime's pricing
    for (const price of regimePricing) {
      await pool.query(
        `INSERT INTO pricings(regime_id, name, total_seats, available_seats, amount, affiliate_amount) 
        VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          newRegime.rows[0].id,
          price.pricingName,
          price.pricingTotalSeats,
          price.pricingTotalSeats,
          price.pricingAmount,
          price.pricingAffiliateAmount,
        ]
      );
    }
    await pool.query(
      `
      INSERT INTO regime_participant(participant_id, regime_id, participant_role) 
      VALUES($1, $2, $3) RETURNING *
      `,
      [newRegime.rows[0].creator_id, newRegime.rows[0].id, "creator"]
    );
    await pool.query("COMMIT");
    //credentials for email transportation
    const transport = nodemailer.createTransport(Helpers.mailCredentials);

    await transport.sendMail({
      from: "Reventlify <reventlifyhub@outlook.com>",
      to: "edijay17@gmail.com",
      subject: "Newly Created Regime",
      text: `Congrats ${userName} just successfully created ${newRegime.rows[0].name} a ${newRegime.rows[0].type} type event with Reventlify.`,
      html: `<h1>Newly Created Regime</h1>
              <p>Congrats ${userName} just successfully created
              <strong>${newRegime.rows[0].name}
              </strong> a ${newRegime.rows[0].type} type event with <strong>Reventlify</strong></p>`,
    });
    await transport.sendMail({
      from: "Reventlify <reventlifyhub@outlook.com>",
      to: email,
      subject: "Regime Creation Successful",
      text: `${userName} you have successfully created ${newRegime.rows[0].name} a ${newRegime.rows[0].type} type of event, thank you for choosing Reventlify.`,
      html: `<h2>Regime Creation Successful</h2>
              <p>${userName} you have successfully created
              <strong>${newRegime.rows[0].name}
              </strong> a ${newRegime.rows[0].type} type of event,
              thank you for choosing <strong>Reventlify</strong>.</p>`,
    });

    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details: "success",
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(200).json({ "Regime Creation": "Successful!" });
  } catch (error) {
    await pool.query("ROLLBACK");
    await Log.auditLogs({
      user: req.email,
      action: "Regime Create",
      details: error.message,
      endPoint: "v1/user/regime/create",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(500).json(error.message);
  }
};

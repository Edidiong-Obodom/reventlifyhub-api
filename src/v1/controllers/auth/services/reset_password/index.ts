import { Request, Response } from "express";
import * as bcrypt from "bcrypt";
import * as nodemailer from "nodemailer";
import { pool } from "../../../../../db";
import * as Helpers from "../../../../../helpers/index";
import randomString from "random-string";
import { User } from "../create/createUser.dto";
import Log from "../../../../../utilities/logger";
import { getClientIp } from "../../../../../utilities/logger/allLogs";

const sendPWResetCode = async (req: Request, res: Response) => {
  const currentDate = new Date();
  const { ip, ipLookUp } = await getClientIp(req);
  // Validate email format
  if (!Helpers.emailRegex.test(req.body.email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }
  // Get values from body
  const { email, ...rest } = req.body as Partial<User> & {
    [key: string]: any;
  };

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    await Log.auditLogs({
      user: email,
      action: "Password Reset Code",
      details: extraFields.message,
      endPoint: "v1/auth/pw-reset-code",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: extraFields.message });
  }

  // verification code
  const pwResetCode = randomString({ length: 8 });
  try {
    // Check if user exists
    const user = await pool.query("SELECT * FROM clients WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Password Reset Code",
        details: "User does not exist!",
        endPoint: "v1/auth/pw-reset-code",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(409).json({ message: "User does not exist!" });
    }

    await pool.query(`DELETE FROM password_reset WHERE email = $1`, [email]);
    await pool.query(
      `
                        INSERT INTO password_reset(email, reset_code) 
                        VALUES ($1, $2) RETURNING *
                    `,
      [email, pwResetCode]
    );

    //credentials for email transportation
    const transport = nodemailer.createTransport(Helpers.mailCredentials);

    //sends verification code to clients mail
    const msg = {
      from: "Reventlify <no-reply@reventlify.com>", // sender address
      to: email, // list of receivers
      subject: "Password Reset", // Subject line
      text: `Here is your password reset code: ${pwResetCode}`, // plain text body
      html: `<h3>Password Reset</h3>
      <p>Here is your password reset code: <strong>${pwResetCode}</strong></p>`, //HTML message
    };

    // send mail with defined transport object
    await transport.sendMail(msg);
    await Log.auditLogs({
      user: email,
      action: "Password Reset Code",
      details: "success",
      endPoint: "v1/auth/pw-reset-code",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });

    return res.status(200).json({
      status: "Success",
      message: "Password reset code sent to mail",
    });
  } catch (error) {
    await Log.auditLogs({
      user: email,
      action: "Password Reset Code",
      details: error.message,
      endPoint: "v1/auth/pw-reset-code",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(500).json("Oops something went wrong...");
  }
};

export const verifyPwResetCode = async (req: Request, res: Response) => {
  const fields = ["email", "code"];
  const currentDate = new Date();
  const { ip, ipLookUp } = await getClientIp(req);

  // check data for each field in the body and validate format
  const fieldCheck = Helpers.requiredFields(req.body, fields);

  if (!fieldCheck.success)
    return res.status(400).json({ message: fieldCheck.message });

  // Validate email format
  if (!Helpers.emailRegex.test(req.body.email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  // Get values from body
  const {
    email,
    code: feCode,
    ...rest
  } = req.body as Partial<User> & {
    [key: string]: any;
  };

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    await Log.auditLogs({
      user: email,
      action: "Password Reset Code Verify",
      details: extraFields.message,
      endPoint: "v1/auth/pw-reset-code/verify",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: extraFields.message });
  }
  try {
    // Check if user exists
    const user = await pool.query("SELECT * FROM clients WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Password Reset Code Verify",
        details: "User does not exist!",
        endPoint: "v1/auth/pw-reset-code/verify",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(409).json({ message: "User does not exist!" });
    }

    // gets the real verification code
    const code = await pool.query(
      "SELECT * FROM password_reset WHERE email = $1",
      [email]
    );

    // checks if the code exists
    if (code.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Password Reset Code Verify",
        details:
          "You have made no request to reset your password so no reset code exist.",
        endPoint: "v1/auth/pw-reset-code/verify",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({
        message:
          "You have made no request to reset your password so no reset code exist.",
      });
    }

    // checks if the code entered is valid
    if (code.rows[0].reset_code !== feCode) {
      await Log.auditLogs({
        user: email,
        action: "Password Reset Code Verify",
        details: "Incorrect Code.",
        endPoint: "v1/auth/pw-reset-code/verify",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({ message: "Incorrect Code." });
    }

    await pool.query(
      `UPDATE password_reset 
        SET modified_at = CURRENT_TIMESTAMP , status = $1
        WHERE email = $2`,
      ["success", email]
    );

    await Log.auditLogs({
      user: email,
      action: "Password Reset Code Verify",
      details: "success",
      endPoint: "v1/auth/pw-reset-code/verify",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(200).json({ status: "Success", message: "success" });
  } catch (error) {
    await Log.auditLogs({
      user: email,
      action: "Password Reset Code Verify",
      details: error.message,
      endPoint: "v1/auth/pw-reset-code/verify",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(500).json({ message: "Oops something went wrong..." });
  }
};

const resetPW = async (req: Request, res: Response) => {
  const fields = ["email", "password"];
  const currentDate = new Date();
  const { ip, ipLookUp } = await getClientIp(req);

  // check data for each field in the body and validate format
  const fieldCheck = Helpers.requiredFields(req.body, fields);

  if (!fieldCheck.success)
    return res.status(400).json({ message: fieldCheck.message });

  // Validate email format
  if (!Helpers.emailRegex.test(req.body.email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  // Get values from body
  const { email, password, ...rest } = req.body as Partial<User> & {
    [key: string]: any;
  };

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    await Log.auditLogs({
      user: email,
      action: "Password Reset",
      details: extraFields.message,
      endPoint: "v1/auth/pw-reset",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: extraFields.message });
  }

  // Check if password length lesser than 8 characters
  if (password.length < 8) {
    await Log.auditLogs({
      user: email,
      action: "Password Reset",
      details: "Password must have a minimum of 8 characters.",
      endPoint: "v1/auth/pw-reset",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res
      .status(400)
      .json({ message: "Password must have a minimum of 8 characters." });
  }

  try {
    // Check if user exists
    const user = await pool.query("SELECT * FROM clients WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Password Reset",
        details: "User does not exist!",
        endPoint: "v1/auth/pw-reset",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(409).json({ message: "User does not exist!" });
    }

    // gets the real verification code
    const code = await pool.query(
      "SELECT * FROM password_reset WHERE email = $1",
      [email]
    );

    // checks if code exists
    if (code.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Password Reset",
        details:
          "You have made no request to reset your password so no reset code exist.",
        endPoint: "v1/auth/pw-reset",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({
        message:
          "You have made no request to reset your password so no reset code exist.",
      });
    }

    // checks if the code entered is valid
    if (code.rows[0].status !== "success") {
      await Log.auditLogs({
        user: email,
        action: "Password Reset",
        details:
          "Can't reset password since the password reset code hasn't been verified",
        endPoint: "v1/auth/pw-reset",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({
        message:
          "Can't reset password since the password reset code hasn't been verified",
      });
    }

    // hashes password
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE clients 
      SET modified_at = CURRENT_TIMESTAMP , password = $1
      WHERE email = $2`,
      [hashedPassword, email]
    );

    await pool.query(`DELETE FROM password_reset WHERE email = $1`, [email]);

    await Log.auditLogs({
      user: email,
      action: "Password Reset",
      details: "success",
      endPoint: "v1/auth/pw-reset",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res
      .status(200)
      .json({ status: "Success", message: "Password reset successful" });
  } catch (error) {
    console.log(error);
    await Log.auditLogs({
      user: email,
      action: "Password Reset",
      details: error.message,
      endPoint: "v1/auth/pw-reset",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export { sendPWResetCode, resetPW };

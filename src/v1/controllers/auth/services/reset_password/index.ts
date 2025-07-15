import { Request, Response } from "express";
import * as bcrypt from "bcrypt";
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
    req.auditData = {
      user: email,
      action: "Password Reset Code",
      details: extraFields.message,
    };
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
      req.auditData = {
        user: email,
        action: "Password Reset Code",
        details: "User does not exist!",
      };
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

    //sends verification code to clients mail
    const msg = {
      from: "Reventlify <no-reply@reventlify.com>", // sender address
      to: email, // list of receivers
      subject: "Password Reset", // Subject line
      text: `Hello ${user.rows[0].user_name}, here is your password reset code: ${pwResetCode}`, // plain text body
      html: `
                        <h3 style="color: #111827;">Hello ${user.rows[0].user_name},</h3>
                        <p style="color: #374151;">
                          Here is your password reset code:
                        </p>
                        <div
                          style="font-size: 28px; font-weight: bold; color: #6366f1; text-align: center; margin: 60px 0;"
                        >
                          ${pwResetCode}
                        </div>
                        <p style="color: #6b7280;">
                          This code is valid for the next 10 minutes. If you didn't request this, please ignore this email or contact support: support@reventlify.com.
                        </p>
                        <p style="margin-top: 30px; color: #6b7280;">Best regards,<br />The Reventlify Team</p>`, //HTML message
    };

    // send mail with defined transport object
    await Helpers.sendMail({
      email: msg.to,
      subject: msg.subject,
      mailBodyText: msg.text,
      mailBodyHtml: Helpers.mailHTMLBodyLayout({
        subject: msg.subject,
        body: msg.html,
      }),
    });
    req.auditData = {
      user: email,
      action: "Password Reset Code",
      details: "success",
    };

    return res.status(200).json({
      status: "Success",
      message: "Password reset code sent to mail",
    });
  } catch (error) {
    req.auditData = {
      user: email,
      action: "Password Reset Code",
      details: error?.message ?? error?.toString(),
    };
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
    req.auditData = {
      user: email,
      action: "Password Reset Code Verify",
      details: extraFields.message,
    };
    return res.status(400).json({ message: extraFields.message });
  }
  try {
    // Check if user exists
    const user = await pool.query("SELECT * FROM clients WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      req.auditData = {
        user: email,
        action: "Password Reset Code Verify",
        details: "User does not exist!",
      };
      return res.status(409).json({ message: "User does not exist!" });
    }

    // gets the real verification code
    const code = await pool.query(
      "SELECT * FROM password_reset WHERE email = $1",
      [email]
    );

    // checks if the code exists
    if (code.rows.length === 0) {
      req.auditData = {
        user: email,
        action: "Password Reset Code Verify",
        details:
          "You have made no request to reset your password so no reset code exist.",
      };
      return res.status(400).json({
        message:
          "You have made no request to reset your password so no reset code exist.",
      });
    }

    // checks if the code entered is valid
    if (code.rows[0].reset_code !== feCode) {
      req.auditData = {
        user: email,
        action: "Password Reset Code Verify",
        details: "Incorrect Code.",
      };
      return res.status(400).json({ message: "Incorrect Code." });
    }

    await pool.query(
      `UPDATE password_reset 
        SET modified_at = CURRENT_TIMESTAMP , status = $1
        WHERE email = $2`,
      ["success", email]
    );

    req.auditData = {
      user: email,
      action: "Password Reset Code Verify",
      details: "success",
    };
    return res.status(200).json({ status: "Success", message: "success" });
  } catch (error) {
    req.auditData = {
      user: email,
      action: "Password Reset Code Verify",
      details: error?.message ?? error?.toString(),
    };
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
    req.auditData = {
      user: email,
      action: "Password Reset",
      details: extraFields.message,
    };
    return res.status(400).json({ message: extraFields.message });
  }

  // Check if password length lesser than 8 characters
  if (password.length < 8) {
    req.auditData = {
      user: email,
      action: "Password Reset",
      details: "Password must have a minimum of 8 characters.",
    };
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
      req.auditData = {
        user: email,
        action: "Password Reset",
        details: "User does not exist!",
      };
      return res.status(409).json({ message: "User does not exist!" });
    }

    // gets the real verification code
    const code = await pool.query(
      "SELECT * FROM password_reset WHERE email = $1",
      [email]
    );

    // checks if code exists
    if (code.rows.length === 0) {
      req.auditData = {
        user: email,
        action: "Password Reset",
        details: "You have made no request to reset your password.",
      };
      return res.status(400).json({
        message: "You have made no request to reset your password.",
      });
    }

    // checks if the code entered is valid
    if (code.rows[0].status !== "success") {
      req.auditData = {
        user: email,
        action: "Password Reset",
        details:
          "Can't reset password since the password reset code hasn't been verified",
      };
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

    req.auditData = {
      user: email,
      action: "Password Reset",
      details: "success",
    };
    return res
      .status(200)
      .json({ status: "Success", message: "Password reset successful" });
  } catch (error) {
    req.auditData = {
      user: email,
      action: "Password Reset",
      details: error?.message ?? error?.toString(),
    };
    return res.status(500).json({ message: "Internal server error" });
  }
};

export { sendPWResetCode, resetPW };

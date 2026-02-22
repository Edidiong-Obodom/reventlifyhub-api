import { Request, Response } from "express";
import { User } from "./createUser.dto";
import * as bcrypt from "bcrypt";
import { pool } from "../../../../../db";
import * as Helpers from "../../../../../helpers/index";
import randomString from "random-string";

interface ExtendUser extends User {
  code: string;
}

const sendVerificationCode = async (req: Request, res: Response) => {
  const fields = ["email", "password", "userName"];

  // check data for each field in the body and validate format
  const fieldCheck = Helpers.requiredFields(req.body, fields);

  if (!fieldCheck.success)
    return res.status(400).json({ message: fieldCheck.message });

  // Validate email format
  if (!Helpers.emailRegex.test(req.body.email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  // Get values from body
  const { email, password, userName, ...rest } = req.body as User & {
    [key: string]: any;
  };

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    req.auditData = {
      user: email,
      action: "Signup Send Code",
      details: extraFields.message,
    };
    return res.status(400).json({ message: extraFields.message });
  }
  // Check if password length lesser than 8 characters
  if (password.length < 8) {
    req.auditData = {
      user: email,
      action: "Signup Send Code",
      details: "Password must have a minimum of 8 characters.",
    };
    return res
      .status(400)
      .json({ message: "Password must have a minimum of 8 characters." });
  }

  // verification code
  const emailVCode = randomString({ length: 5 });

  try {
    // deletes client from limbo
    await pool.query("DELETE FROM limbo WHERE email = $1", [email]);

    // checks if user already exists
    const user = await pool.query("SELECT * FROM clients WHERE email = $1", [
      email,
    ]);

    // action if user already exists
    if (user.rows.length !== 0) {
      req.auditData = {
        user: email,
        action: "Signup Send Code",
        details: "User already exist!",
      };
      return res.status(409).json({ message: "User already exist!" });
    }

    // checks if username already exists
    const user_name = await pool.query(
      "SELECT * FROM clients WHERE user_name = $1",
      [email],
    );
    const user_name_limbo = await pool.query(
      "SELECT * FROM limbo WHERE user_name = $1",
      [email],
    );

    // action if username already exists
    if (user_name.rows.length !== 0 || user_name_limbo.rows.length !== 0) {
      req.auditData = {
        user: email,
        action: "Signup Send Code",
        details: "User name already taken!",
      };
      return res.status(409).json({ message: "Username already taken!" });
    }

    // hashes password
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO limbo(email, code, status, password, user_name, first_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [email, emailVCode, "pending", hashedPassword, userName, userName],
    );

    //sends verification code to clients mail
    const msg = {
      from: "Reventlify <no-reply@reventlify.com>", // sender address
      to: email, // list of receivers
      subject: "Email Verification", // Subject line
      text: `Hello ${userName}, your One-Time Password (OTP) is: ${emailVCode}`, // plain text body
      html: `
                        <h3 style="color: #111827;">Hello ${userName},</h3>
                        <p style="color: #374151;">
                          Your One-Time Password (OTP) is:
                        </p>
                        <div
                          style="font-size: 28px; font-weight: bold; color: #6366f1; text-align: center; margin: 60px 0;"
                        >
                          ${emailVCode}
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
      action: "Signup Send Code",
      details: "success",
    };
    return res.status(200).json({
      Status: "Sent Successfully!",
      toEmail: email,
    });
  } catch (error) {
    req.auditData = {
      user: email,
      action: "Signup Send Code",
      details: error?.message ?? error?.toString(),
    };
    return res.status(500).json("Oops something went wrong.");
  }
};

const register = async (req: Request, res: Response) => {
  const fields = ["email", "code"];
  // check data for each field in the body and validate format
  const fieldCheck = Helpers.requiredFields(req.body, fields);

  if (!fieldCheck.success)
    return res.status(400).json({ message: fieldCheck.message });

  // Get values from body
  const {
    email,
    code: feCode,
    ...rest
  } = req.body as Partial<ExtendUser> & {
    [key: string]: any;
  };

  // Validate email format
  if (!Helpers.emailRegex.test(req.body.email)) {
    req.auditData = {
      user: email,
      action: "Signup Register",
      details: "Invalid email format.",
    };
    return res.status(400).json({ message: "Invalid email format." });
  }

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    req.auditData = {
      user: email,
      action: "Signup Register",
      details: extraFields.message,
    };
    return res.status(400).json({ message: extraFields.message });
  }

  try {
    // Check if user already exists
    const user = await pool.query("SELECT * FROM clients WHERE email = $1", [
      email,
    ]);

    if (user.rows.length !== 0) {
      req.auditData = {
        user: email,
        action: "Signup Register",
        details: "User already exists!",
      };
      return res.status(409).json({ message: "User already exists!" });
    }

    // gets the real verification code
    const code = await pool.query("SELECT * FROM limbo WHERE email = $1", [
      email,
    ]);

    // checks if code was sent to the email
    if (code.rows.length === 0) {
      req.auditData = {
        user: email,
        action: "Signup Register",
        details: "No code was sent to this email.",
      };
      return res
        .status(400)
        .json({ message: "No code was sent to this email." });
    }

    // checks if the code entered is valid
    if (code.rows[0].code !== feCode) {
      req.auditData = {
        user: email,
        action: "Signup Register",
        details: "Incorrect Code.",
      };
      return res.status(400).json({ message: "Incorrect Code." });
    }

    const newUser = await pool.query(
      `
        INSERT INTO clients(
          email, password, user_name
          ) VALUES($1, $2, $3) RETURNING *`,
      [email, code.rows[0].password, code.rows[0].user_name],
    );

    // deletes client from limbo
    await pool.query("DELETE FROM limbo WHERE email = $1", [email]);

    //Welcome Message
    const msg = {
      from: "Reventlify <no-reply@reventlify.com>", // sender address
      to: newUser.rows[0].email, // list of receivers
      subject: "Welcome To Reventlify", // Subject line
      text: `Hello ${newUser.rows[0].user_name}, thank you for choosing Reventlify.`, // plain text body
      html: `
                        <h3 style="color: #111827;">Hello ${newUser.rows[0].user_name},</h3>
                        <p style="color: #374151;">
                          Thank you for choosing Reventlify
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
      action: "Signup Register",
      details: "success",
    };

    // return
    return res.status(200).json({
      registration: "Successful!",
      user_created: newUser.rows[0].email,
    });
  } catch (error) {
    req.auditData = {
      user: email,
      action: "Signup Register",
      details: error?.message ?? error.toString(),
    };
    return res.status(500).json({ message: "Oops something went wrong..." });
  }
};

export { register, sendVerificationCode };

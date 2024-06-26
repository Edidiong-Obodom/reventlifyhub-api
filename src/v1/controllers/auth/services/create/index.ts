import { Request, Response } from "express";
import { User } from "./createUser.dto";
import * as bcrypt from "bcrypt";
import * as nodemailer from "nodemailer";
import { pool } from "../../../../../db";
import * as Helpers from "../../../../../helpers/index";
import randomString from "random-string";
import Log from "../../../../../utilities/logger";
import { getClientIp } from "../../../../../utilities/logger/allLogs";

interface ExtendUser extends User {
  code: string;
}

const sendVerificationCode = async (req: Request, res: Response) => {
  const fields = ["email", "password", "userName"];
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
  const { email, password, userName, ...rest } = req.body as User & {
    [key: string]: any;
  };

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    await Log.auditLogs({
      user: email,
      action: "Signup Send Code",
      details: extraFields.message,
      endPoint: "v1/auth/signup/send-code",
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
      action: "Signup Send Code",
      details: "Password must have a minimum of 8 characters.",
      endPoint: "v1/auth/signup/send-code",
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
      await Log.auditLogs({
        user: email,
        action: "Signup Send Code",
        details: "User already exist!",
        endPoint: "v1/auth/signup/send-code",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(409).json({ message: "User already exist!" });
    }

    // checks if username already exists
    const user_name = await pool.query(
      "SELECT * FROM clients WHERE user_name = $1",
      [email]
    );
    const user_name_limbo = await pool.query(
      "SELECT * FROM limbo WHERE user_name = $1",
      [email]
    );

    // action if username already exists
    if (user_name.rows.length !== 0 || user_name_limbo.rows.length !== 0) {
      await Log.auditLogs({
        user: email,
        action: "Signup Send Code",
        details: "User name already taken!",
        endPoint: "v1/auth/signup/send-code",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(409).json({ message: "Username already taken!" });
    }

    // hashes password
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO limbo(email, code, status, password, user_name) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [email, emailVCode, "pending", hashedPassword, userName]
    );

    //credentials for email transportation
    const transport = nodemailer.createTransport(Helpers.mailCredentials);

    //sends verification code to clients mail
    const msg = {
      from: "Reventlify <reventlifyhub@outlook.com>", // sender address
      to: email, // list of receivers
      subject: "Email Verification", // Subject line
      text: `Here is your verification code: ${emailVCode}`, // plain text body
      html: `<h3>Email Verification</h3>
      <p>Here is your verification code: <strong>${emailVCode}</strong></p>`, //HTML message
    };

    // send mail with defined transport object
    await transport.sendMail(msg);
    await Log.auditLogs({
      user: email,
      action: "Signup Send Code",
      details: "success",
      endPoint: "v1/auth/signup/send-code",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(200).json({
      Status: "Sent Successfully!",
      toEmail: email,
    });
  } catch (error) {
    await Log.auditLogs({
      user: email,
      action: "Signup Send Code",
      details: error.message,
      endPoint: "v1/auth/signup/send-code",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(500).json("Oops something went wrong.");
  }
};

const register = async (req: Request, res: Response) => {
  const fields = ["email", "code"];
  const currentDate = new Date();
  const { ip, ipLookUp } = await getClientIp(req);
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
    await Log.auditLogs({
      user: email,
      action: "Signup Register",
      details: "Invalid email format.",
      endPoint: "v1/auth/signup/register",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: "Invalid email format." });
  }

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    await Log.auditLogs({
      user: email,
      action: "Signup Register",
      details: extraFields.message,
      endPoint: "v1/auth/signup/register",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: extraFields.message });
  }

  try {
    // Check if user already exists
    const user = await pool.query("SELECT * FROM clients WHERE email = $1", [
      email,
    ]);

    if (user.rows.length !== 0) {
      await Log.auditLogs({
        user: email,
        action: "Signup Register",
        details: "User already exists!",
        endPoint: "v1/auth/signup/register",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(409).json({ message: "User already exists!" });
    }

    // gets the real verification code
    const code = await pool.query("SELECT * FROM limbo WHERE email = $1", [
      email,
    ]);

    // checks if code was sent to the email
    if (code.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Signup Register",
        details: "No code was sent to this email.",
        endPoint: "v1/auth/signup/register",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res
        .status(400)
        .json({ message: "No code was sent to this email." });
    }

    // checks if the code entered is valid
    if (code.rows[0].code !== feCode) {
      await Log.auditLogs({
        user: email,
        action: "Signup Register",
        details: "Incorrect Code.",
        endPoint: "v1/auth/signup/register",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({ message: "Incorrect Code." });
    }

    const newUser = await pool.query(
      `
        INSERT INTO clients(
          email, password, user_name
          ) VALUES($1, $2, $3) RETURNING *`,
      [email, code.rows[0].password, code.rows[0].user_name]
    );

    // deletes client from limbo
    await pool.query("DELETE FROM limbo WHERE email = $1", [email]);

    //credentials for email transportation
    const transport = nodemailer.createTransport(Helpers.mailCredentials);

    //Welcome Message
    const msg = {
      from: "Reventlify <reventlifyhub@outlook.com>", // sender address
      to: newUser.rows[0].email, // list of receivers
      subject: "Welcome To Reventlify", // Subject line
      text: `${newUser.rows[0].user_name} thank you for choosing Reventlify.`, // plain text body
      html: `<h2>Welcome To Reventlify</h2>
        <p>${newUser.rows[0].user_name} thank you for choosing <strong>Reventlify</strong>.</p>`, //HTML message
    };

    // send mail with defined transport object
    await transport.sendMail(msg);
    await Log.auditLogs({
      user: email,
      action: "Signup Register",
      details: "success",
      endPoint: "v1/auth/signup/register",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });

    // return
    return res.status(200).json({
      registration: "Successful!",
      user_created: newUser.rows[0].email,
    });
  } catch (error) {
    await Log.auditLogs({
      user: email,
      action: "Signup Register",
      details: error.message,
      endPoint: "v1/auth/signup/register",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(500).json({ message: "Oops something went wrong..." });
  }
};

export { register, sendVerificationCode };

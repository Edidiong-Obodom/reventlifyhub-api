import { Request, Response } from "express";
import * as bcrypt from "bcrypt";
import * as nodemailer from "nodemailer";
import { pool } from "../../../../../db";
import * as Helpers from "../../../../../helpers/index";
import randomString from "random-string";
import { User } from "../create/createUser.dto";

const sendPWResetCode = async (req: Request, res: Response) => {
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

  if (!extraFields.success)
    return res.status(400).json({ message: extraFields.message });

  // verification code
  const pwResetCode = randomString({ length: 8 });
  try {
    // Check if user exists
    const user = await pool.query("SELECT * FROM clients WHERE email = $1", [
      email,
    ]);

    if (user.rows[0].length === 0)
      return res.status(409).json({ message: "User does not exist!" });

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
      from: "Reventlify <reventlifyhub@outlook.com>", // sender address
      to: email, // list of receivers
      subject: "Password Reset", // Subject line
      text: `Here is your password reset code: ${pwResetCode}`, // plain text body
      html: `<h3>Password Reset</h3>
      <p>Here is your password reset code: <strong>${pwResetCode}</strong></p>`, //HTML message
    };

    // send mail with defined transport object
    await transport.sendMail(msg);

    return res.status(200).json({
      status: "Success",
      message: "Password reset code sent to mail",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(error.message);
  }
};

const resetPW = async (req: Request, res: Response) => {
  const fields = ["email", "password", "code"];

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
    password,
    code: feCode,
    ...rest
  } = req.body as Partial<User> & {
    [key: string]: any;
  };

  // Check if there are any additional properties in the request body
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success)
    return res.status(400).json({ message: extraFields.message });

  // Check if password length lesser than 8 characters
  if (password.length < 8)
    return res
      .status(400)
      .json({ message: "Password must have a minimum of 8 characters." });

  try {
    // Check if user exists
    const user = await pool.query("SELECT * FROM clients WHERE email = $1", [
      email,
    ]);

    if (user.rows[0].length === 0)
      return res.status(409).json({ message: "User does not exist!" });

    // gets the real verification code
    const code = await pool.query(
      "SELECT * FROM password_reset WHERE email = $1",
      [email]
    );

    // checks if the code entered is valid
    if (code.rows[0].reset_code !== feCode)
      return res.status(400).json("Incorrect Code.");

    // hashes password
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE clients 
      SET modified_at = CURRENT_TIMESTAMP , password = $1
      WHERE email = $2`,
      [hashedPassword, email]
    );

    await pool.query(`DELETE FROM password_reset WHERE email = $1`, [email]);

    return res
      .status(200)
      .json({ status: "Success", message: "Password reset successful" });
  } catch (error) {
    console.log(error);
    return res.status(500).json("Internal server error");
  }
};

export { sendPWResetCode, resetPW };

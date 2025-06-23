import { Request, Response } from "express";
import * as bcrypt from "bcrypt";
import * as Helpers from "../../../../../helpers/index";
import { Login } from "./index.dto";
import { pool } from "../../../../../db";
import { JwtPayload } from "jsonwebtoken";
import * as jwt from "jsonwebtoken";
import Log from "../../../../../utilities/logger";
import { getClientIp } from "../../../../../utilities/logger/allLogs";

const login = async (req: Request, res: Response) => {
  const requiredFields = ["email", "password"];
  const currentDate = new Date();
  const { ip, ipLookUp } = await getClientIp(req);

  // check data for each field in the body and validate format
  for (const field of requiredFields) {
    if (!req?.body?.[field]) {
      return res.status(400).json({ message: `${field} field is empty.` });
    }
  }

  const { email, password, ...rest } = req.body as Login & {
    [key: string]: any;
  };

  // Check if there are any additional properties in the request body
  if (Object.keys(rest).length > 0) {
    await Log.auditLogs({
      user: email,
      action: "Login",
      details: "Additional properties in the request body are not allowed.",
      endPoint: "v1/auth/login",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({
      message: "Additional properties in the request body are not allowed.",
    });
  }

  // email validation
  if (!Helpers.emailRegex.test(email)) {
    await Log.auditLogs({
      user: email,
      action: "Login",
      details: "Invalid email format.",
      endPoint: "v1/auth/login",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: "Invalid email format." });
  }

  try {
    // checks for user in db
    const user = await pool.query(`SELECT * FROM clients WHERE email = $1 `, [
      email,
    ]);

    if (!user.rows[0]) {
      await Log.auditLogs({
        user: email,
        action: "Login",
        details: "User does not exist.",
        endPoint: "v1/auth/login",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(401).json({ message: "User does not exist." });
    }

    // checks if password is correct
    const passwordIsValid = await bcrypt.compare(
      password,
      user.rows[0].password
    );

    if (!passwordIsValid) {
      await Log.auditLogs({
        user: email,
        action: "Login",
        details: "Invalid password.",
        endPoint: "v1/auth/login",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(401).json({ message: "Invalid password." });
    }

    const userData = {
      user: user.rows[0].id,
      email,
      firstName: user.rows[0].first_name,
      userName: user.rows[0].user_name,
      lastName: user.rows[0].last_name,
      nationality: user.rows[0].nationality,
      permissions: {},
    };

    // Sign user's token
    const token = jwt.sign(userData, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "30d",
    });

    // Gets token expiry date
    const expiresAt = jwt.decode(token) as JwtPayload;

    await Log.auditLogs({
      user: userData.email,
      action: "Login",
      details: "success",
      endPoint: "v1/auth/login",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });

    return res.status(200).json({
      auth: true,
      expiresAt: expiresAt.exp,
      user: { ...userData, token },
    });
  } catch (error) {
    await Log.auditLogs({
      user: email,
      action: "Login",
      details: error.message,
      endPoint: "v1/auth/login",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(500).json({ message: "Oops something went wrong..." });
  }
};

export { login };

import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { ExtendedRequest } from "./authenticateToken.dto";

dotenv.config();

// Authenticate
function authenticateToken(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"]; // Bearer TOKEN
  const token = authHeader?.split(" ")[1];
  if (token == null) return res.status(401).json({ error: "Null Token" });
  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET,
    (error: any, user: ExtendedRequest) => {
      if (error) return res.status(403).json({ error: error.message });
      req.user = user.user;
      req.email = user.email;
      req.firstName = user.firstName;
      req.lastName = user.lastName;
      req.userName = user.userName;
      req.nationality = user.nationality;
      req.permissions = user.permissions;
      next();
    }
  );
}

export default authenticateToken;

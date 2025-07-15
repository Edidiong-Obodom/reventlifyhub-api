import { Request } from "express";

export interface Request extends Request {
    user: string;
    email: string;
    firstName: string;
    lastName: string;
    userName: string;
    nationality: string;
  }
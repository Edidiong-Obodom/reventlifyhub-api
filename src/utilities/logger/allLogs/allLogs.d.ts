import { Request, Response } from "express";
import { IPInfo } from "./auditLogs";

export interface MetaData {
  ipAddress?: string | string[];
  location?: Partial<IPInfo>;
}

export interface ReturnResponse {
  req: Request | Request;
  res?: Response;
  endPoint?: string;
  logResponse?: any;
  logStatusCode?: number;
}

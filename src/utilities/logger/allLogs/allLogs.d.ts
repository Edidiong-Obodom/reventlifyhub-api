import { Request } from "express";
import { ExtendedRequest } from "../../authenticateToken/authenticateToken.dto";
import { IPinfo } from "node-ipinfo";

export interface MetaData {
  ipAddress?: string | string[];
  location?: Partial<IPinfo>;
}

export interface ReturnResponse {
  req: Request | ExtendedRequest;
  res?: any;
  endPoint?: string;
  logResponse?: any;
  logStatusCode?: number;
}

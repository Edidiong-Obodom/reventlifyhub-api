import { Request } from "express";
import { IPInfo } from ".";

export interface AuditLogs {
  req?: Request;
  user: string;
  action: string;
  details?: string;
  endPoint: string;
  date?: Date;
  metaData?: Partial<IPInfo>;
  statusCode?: number;
  method?: string;
  duration?: string;
  userAgent?: string;
}

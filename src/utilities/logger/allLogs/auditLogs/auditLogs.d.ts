import { MetaData } from "../allLogs";

export interface AuditLogs {
  user: string;
  action: string;
  details?: string;
  endPoint: string;
  date: Date;
  metaData?: MetaData;
}

// types/express.d.ts
import { IPInfo } from "../../src/utilities/logger/allLogs/auditLogs/index";
interface Permission {
  // Define the structure of each permission object
  // Adjust the types according to the actual structure of each permission
  name: string;
  description: string;
  // Add more properties if necessary
}

declare global {
  namespace Express {
    interface Request {
      ip?: string;
      ipLookUp?: Partial<IPInfo>;
      skipAuditLog?: boolean;
      auditData?: { user?: string; details?: string; action?: string };
      user: string;
      email: string;
      firstName: string;
      lastName: string;
      userName: string;
      nationality: string;
      permissions: Permission[]; // Array of Permission objects
    }
  }
}

export {};

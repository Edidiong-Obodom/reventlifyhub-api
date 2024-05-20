import { Request } from "express";
export interface Permission {
  // Define the structure of each permission object
  // Adjust the types according to the actual structure of each permission
  name: string;
  description: string;
  // Add more properties if necessary
}

export interface ExtendedRequest extends Request {
    user: string;
    email: string;
    firstName: string;
    lastName: string;
    userName: string;
    nationality: string;
    permissions: Permission; // Array of Permission objects
  }
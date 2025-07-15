import { Request } from "express";
import * as Helpers from "../helpers/index";

/**
 * Validates the presence and format of required fields in the provided body object.
 * @param body The object containing the data to be validated.
 * @param fields An array of strings specifying the names of the fields to be checked.
 * @returns An object indicating the validation result.
 */
export const requiredFields = (
  body: any,
  fields: string[],
  notBody?: string
): {
  success: boolean;
  message: string;
} => {
  // check data for each field in the body and validate format
  for (const field of fields) {
    if (
      body?.[field] === undefined ||
      (typeof body?.[field] === "string" && body?.[field] === "")
    ) {
      return {
        success: false,
        message: `${field} field in the request ${
          !notBody ? "body" : notBody.toLowerCase()
        } is empty.`,
      };
    } else if (
      field.toLowerCase().includes("name") &&
      !Helpers.nameRegex.test(body?.[field]) &&
      (field.toLowerCase().includes("user") ||
        field.toLowerCase().includes("first") ||
        field.toLowerCase().includes("middle") ||
        field.toLowerCase().includes("last") ||
        field.toLowerCase().includes("maiden"))
    ) {
      return {
        success: false,
        message: `Invalid name format in the ${field} field in the request ${
          !notBody ? "body" : notBody.toLowerCase()
        }.`,
      };
    }
  }
  return {
    success: true,
    message: "All fields passed.",
  };
};

/**
 * Checks if there are any additional properties in the provided object.
 * @param rest An object representing the additional properties to be checked.
 * @returns An object indicating whether additional properties were found and a corresponding message.
 */
export const noExtraFields = (
  rest: {
    [key: string]: any;
  },
  notBody?: string
): {
  success: boolean;
  message: string;
} => {
  // Check if there are any additional properties in the request body
  if (Object.keys(rest).length > 0) {
    return {
      success: false,
      message: `Additional properties in the request ${
        !notBody ? "body" : notBody.toLowerCase()
      } are not allowed.`,
    };
  }

  return {
    success: true,
    message: `No additional property in the request ${
      !rest.notBody ? "body" : rest.notBody.toLowerCase()
    } detected.`,
  };
};

interface GetClientIpResult {
  ip: string;
  source: "forwarded-for" | "real-ip" | "request-ip" | "internal-header";
  trusted: boolean;
}

export const getIp = (req: Request | Request): GetClientIpResult => {
  const trustedInternalHeader =
    req.headers["x-internal-auth"] === process.env.INTERNAL_SHARED_SECRET;

  const internalRealIp = req.headers["x-real-client-ip"] as string | undefined;

  if (trustedInternalHeader && internalRealIp) {
    return {
      ip: internalRealIp,
      source: "internal-header",
      trusted: true,
    };
  }

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const ip = forwarded.split(",").pop().trim();
    return {
      ip,
      source: "forwarded-for",
      trusted: true,
    };
  }

  if (Array.isArray(forwarded)) {
    const ip = forwarded[forwarded.length - 1].trim();
    return {
      ip,
      source: "forwarded-for",
      trusted: true,
    };
  }

  if (req.ip) {
    return {
      ip: req.ip,
      source: "request-ip",
      trusted: false,
    };
  }

  return {
    ip: "unknown",
    source: "request-ip",
    trusted: false,
  };
};

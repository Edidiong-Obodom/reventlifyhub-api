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
    if (!body?.[field]) {
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

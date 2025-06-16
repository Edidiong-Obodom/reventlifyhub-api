import { words, capitalize } from "lodash";
import * as Helper from "./index";

/**
 * Converts a string to a title case, capitalizing the first letter of each word.
 *
 * @param params The input string to be converted to title case.
 * @returns The input string converted to title case, or null if the input string is null or empty.
 */
export const startWithCase = (params: string | null): string | null => {
  if (params === null || params.length === 0) {
    return null;
  } else {
    const returner = (whatName: string, index: number): string => {
      if (index === 0) {
        return capitalize(whatName);
      } else {
        return " " + capitalize(whatName);
      }
    };

    const nameHandler = (n: string): string | undefined => {
      let handleName = "";
      if (n.length === 0) {
        return;
      } else {
        const name = words(n, /[^, ]+/g);
        name.map((user, i) => {
          return (handleName = handleName + returner(user, i));
        });
        return handleName;
      }
    };

    return nameHandler(params);
  }
};

/**
 * Generates an error message for pricing validation.
 *
 * @param message Initial message gotten from validation helper.
 * @param i Which pricing object in the pricing array failed validation.
 * @returns The final error message.
 */
export const pricingErrorMessage = (message: string, i: number): string => {
  return `${message} ${i <= 2 ? "In the" : "On pricing number"} ${
    i <= 2
      ? `${i === 0 ? "1st pricing" : i === 1 ? "2nd pricing" : "3rd pricing"}`
      : Number(i + 1)
  }.`;
};

/**
 * Checks if the provided date is valid, for February.
 * @param {string} date - The date string to be checked.
 * @returns {boolean} Returns true if the date is valid, otherwise false.
 *
 * This function validates the date against the allowed date format and ensures
 * that for February, the day part does not exceed 29.
 */
export const februaryCheck = (date: string): boolean => {
  if (!Helper.allowedDateFormat.test(date)) {
    return false;
  }

  if (date.slice(5, 7) === "02" && Number(date.slice(8, date.length)) > 29) {
    return false;
  }

  return true;
};

/**
 * Sends an email using the AlterMail external service.
 *
 * @param {Object} params - The parameters for the email.
 * @param {string} params.email - The recipient's email address.
 * @param {string} params.subject - The subject of the email.
 * @param {string} params.mailBodyHtml - The HTML version of the email body.
 * @param {string} params.mailBodyText - The plain text version of the email body.
 *
 * @returns {Promise<{ request: Response | undefined; response: any }>}
 * An object containing the original fetch request and the parsed JSON response,
 * or `undefined` values if the request fails.
 */
export const sendMail = async ({
  email,
  subject,
  mailBodyHtml,
  mailBodyText,
}: {
  email: string;
  subject: string;
  mailBodyHtml: string;
  mailBodyText?: string;
}) => {
  try {
    const externalCall = await fetch(
      `${process.env.ALTERMAIL_URL}/v1/user/email/send`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          token: `${process.env.ALTERMAIL_TOKEN}`,
        },
        body: JSON.stringify({
          email,
          subject,
          mailBodyHtml,
          mailBodyText,
        }),
      }
    );

    const response = await externalCall.json();

    return { request: externalCall, response };
  } catch (error) {
    console.log("error sending mail: ", error);
    return { request: undefined, response: undefined };
  }
};

/**
 * Determines whether to use "a" or "an" before a given word based on its first letter.
 *
 * @param {string} str - The word to evaluate.
 * @returns {string} - Returns "an" if the word starts with a vowel sound, otherwise "a".
 *
 * @example
 * aOrAn("apple"); // returns "an"
 * aOrAn("banana"); // returns "a"
 */
export const aOrAn = (str: string): "a" | "an" => {
  if (!str || typeof str !== "string") return "a"; // Default to 'a' if input is invalid

  const firstLetter = str.trim().charAt(0).toLowerCase();

  return ["a", "e", "i", "o", "u"].includes(firstLetter) ? "an" : "a";
};

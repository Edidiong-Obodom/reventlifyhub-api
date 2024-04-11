import moment from "moment";
import { pool } from "../db";

/**
 * Finds a user in the database by their ID asynchronously.
 *
 * @param userID The ID of the user to search for.
 * @returns A promise that resolves with the user data if found.
 */
export const findUserById = async (userID: string) => {
  const data = await pool.query("SELECT * FROM clients WHERE id = $1", [
    userID,
  ]);

  return data;
};

/**
 * Finds a user in the database by their Email asynchronously.
 *
 * @param userEmail The Email of the user to search for.
 * @returns A promise that resolves with the user data.
 */
export const findUserByEmail = async (userEmail: string) => {
  const data = await pool.query("SELECT * FROM clients WHERE email = $1", [
    userEmail,
  ]);

  return data;
};

/**
 * Finds a regime name in the database by the input creator_id and input name asynchronously.
 *
 * @param creator_id The ID of the user trying to create the new regime.
 * @param name The name of the regime the user wants to create.
 * @returns A promise that resolves with a boolean.
 */
export const regimeNameCheck = async (
  creator_id: string,
  name: string
): Promise<boolean> => {
  try {
    if (name.length === 0) {
      return false;
    }

    const nameCheck = await pool.query(
      "SELECT * FROM regimes WHERE name ILIKE $1",
      [name]
    );

    if (nameCheck.rows.length > 0) {
      const currentDate = new Date();
      const endDateFormatted = moment(nameCheck.rows[0].end_date).format(
        "YYYY-MM-DD"
      );
      const endDate = new Date(
        endDateFormatted + " " + nameCheck.rows[0].end_time
      );
      const nameCheck1 = await pool.query(
        "SELECT * FROM regimes WHERE name ILIKE $1 and creator_id = $2",
        [name, creator_id]
      );
      if (nameCheck1.rows.length === 0) {
        return false;
      } else if (nameCheck1.rows.length > 0 && currentDate < endDate) {
        return false;
      } else {
        return true;
      }
    }
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

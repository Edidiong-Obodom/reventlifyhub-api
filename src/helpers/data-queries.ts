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

/**
 * Finds a row in a table in the database by the column have the value asynchronously.
 *
 * @param tableName The name of the table we need data from.
 * @param columnName The name of the column to search for.
 * @param searchValue The search value.
 * @returns A promise that resolves with the data if found.
 */
export const getData = async (
  tableName: string,
  columnName: string,
  searchValue: string
) => {
  const data = await pool.query(
    `SELECT * FROM ${tableName} WHERE ${columnName} = $1`,
    [searchValue]
  );
  return data;
};

/**
 * Finds a row in a table in the database by columns that have the value using Customized Operator asynchronously.
 *
 * @param tableName The name of the table we need data from.
 * @param columnName The names of the column to search for.
 * @param searchValue The search values.
 * @returns A promise that resolves with the data if found.
 */
export const getData_CustomOperation = async (
  tableName: string,
  columnName: string[],
  searchValue: string[],
  operations: {
    ins: string[];
    between: string[];
  }
) => {
  const { ins, between } = operations;
  const AndOperation = columnName
    .map((datai, i) => {
      if (i === 0) {
        return `${datai} ${ins[0].trim()} $1 ${
          between.length > 0 ? between[0].trim() : ""
        } `;
      } else {
        return `${datai} ${ins[i].trim()} $${i + 1} ${
          i + 1 <= between.length ? between[i].trim() : ""
        }`;
      }
    })
    .join(" ");

  const data = await pool.query(
    `SELECT * FROM ${tableName} WHERE ${AndOperation}`,
    searchValue
  );
  return data;
};

/**
 * Finds a row in a table in the database by columns that have the value using AND Operator asynchronously.
 *
 * @param tableName The name of the table we need data from.
 * @param columnName The names of the column to search for.
 * @param searchValue The search values.
 * @returns A promise that resolves with the data if found.
 */
export const getData_AndOperation = async (
  tableName: string,
  columnName: string[],
  searchValue: string[]
) => {
  const AndOperation = columnName
    .map((datai, i) => {
      if (i === 0) {
        return `${datai} = $1`;
      } else {
        return `AND ${datai} = $${i + 1}`;
      }
    })
    .join(" ");

  const data = await pool.query(
    `SELECT * FROM ${tableName} WHERE ${AndOperation}`,
    searchValue
  );
  return data;
};

/**
 * Finds a row in a table in the database by columns that have the value using OR Operator asynchronously.
 *
 * @param tableName The name of the table we need data from.
 * @param columnName The names of the column to search for.
 * @param searchValue The search values.
 * @returns A promise that resolves with the data if found.
 */
export const getData_OrOperation = async (
  tableName: string,
  columnName: string[],
  searchValue: string[]
) => {
  const AndOperation = columnName
    .map((datai, i) => {
      if (i === 0) {
        return `${datai} = $1`;
      } else {
        return `OR ${datai} = $${i + 1}`;
      }
    })
    .join(" ");

  const data = await pool.query(
    `SELECT * FROM ${tableName} WHERE ${AndOperation}`,
    searchValue
  );
  return data;
};

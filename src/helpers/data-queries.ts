import moment from "moment";
import { pool } from "../db";

/**
 * Finds a user in the database by their ID asynchronously.
 *
 * @param userID The ID of the user to search for.
 * @returns A promise that resolves with the user data if found.
 */
export const findUserById = async (userID: string = "") => {
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
  name: string,
): Promise<boolean> => {
  try {
    if (name.length === 0) {
      return false;
    }

    const nameCheck = await pool.query(
      "SELECT * FROM regimes WHERE name ILIKE $1",
      [name],
    );

    if (nameCheck.rows.length > 0) {
      const currentDate = new Date();
      const endDateFormatted = moment(nameCheck.rows[0].end_date).format(
        "YYYY-MM-DD",
      );
      const endDate = new Date(
        endDateFormatted + " " + nameCheck.rows[0].end_time,
      );
      const nameCheck1 = await pool.query(
        "SELECT * FROM regimes WHERE name ILIKE $1 and creator_id = $2",
        [name, creator_id],
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
  searchValue: string,
) => {
  const data = await pool.query(
    `SELECT * FROM ${tableName} WHERE ${columnName} = $1`,
    [searchValue],
  );
  return data;
};

/**
 * Executes a custom SELECT query with flexible WHERE conditions and optional row-level locking.
 *
 * This function builds a dynamic SQL query based on the provided column names, search values,
 * and comparison operators. It supports PostgreSQL row-level locking mechanisms to prevent
 * race conditions in concurrent transactions.
 *
 * @param {string} tableName - The name of the database table to query
 * @param {string[]} columnName - Array of column names to use in the WHERE clause
 * @param {string[]} searchValue - Array of values corresponding to each column (must match columnName length)
 * @param {Object} operations - Object defining the SQL operations to use
 * @param {string[]} operations.ins - Array of comparison operators (=, >=, <=, !=, LIKE, etc.) for each column
 * @param {string[]} operations.between - Array of logical operators (AND, OR) to join conditions
 * @param {Object} [options] - Optional configuration for query behavior
 * @param {boolean} [options.forUpdate=false] - Enable row-level locking (FOR UPDATE clause)
 * @param {string[]} [options.columns=['*']] - Specific columns to SELECT (defaults to all columns)
 * @param {boolean} [options.skipLocked=false] - Skip rows that are currently locked by other transactions
 * @param {boolean} [options.noWait=false] - Fail immediately if the row is locked instead of waiting
 *
 * @returns {Promise<QueryResult>} PostgreSQL query result object containing rows and metadata
 *
 * @throws {Error} If column and value arrays don't match in length
 * @throws {Error} If noWait is true and the row is currently locked by another transaction
 * @throws {Error} If database query fails
 *
 * @example
 * // Basic usage without locking
 * const result = await getData_CustomOperation(
 *   "pricings",
 *   ["id", "available_seats"],
 *   [pricingId, 5],
 *   { ins: ["=", ">="], between: ["AND"] }
 * );
 * // SQL: SELECT * FROM pricings WHERE id = $1 AND available_seats >= $2
 *
 * @example
 * // With row-level locking (prevents concurrent modifications)
 * const result = await getData_CustomOperation(
 *   "pricings",
 *   ["id", "available_seats"],
 *   [pricingId, counter],
 *   { ins: ["=", ">="], between: ["AND"] },
 *   { forUpdate: true }
 * );
 * // SQL: SELECT * FROM pricings WHERE id = $1 AND available_seats >= $2 FOR UPDATE
 * // The row will be locked until the transaction commits/rolls back
 *
 * @example
 * // Select specific columns with locking
 * const result = await getData_CustomOperation(
 *   "pricings",
 *   ["regime_id"],
 *   [regimeId],
 *   { ins: ["="], between: [] },
 *   {
 *     forUpdate: true,
 *     columns: ["id", "available_seats", "amount"]
 *   }
 * );
 * // SQL: SELECT id, available_seats, amount FROM pricings WHERE regime_id = $1 FOR UPDATE
 *
 * @example
 * // Non-blocking lock (skip locked rows)
 * const result = await getData_CustomOperation(
 *   "tickets",
 *   ["status"],
 *   ["pending"],
 *   { ins: ["="], between: [] },
 *   {
 *     forUpdate: true,
 *     skipLocked: true
 *   }
 * );
 * // SQL: SELECT * FROM tickets WHERE status = $1 FOR UPDATE SKIP LOCKED
 * // Useful for queue processing - workers skip jobs being processed by others
 *
 * @example
 * // Fail-fast lock (don't wait for locked rows)
 * try {
 *   const result = await getData_CustomOperation(
 *     "pricings",
 *     ["id"],
 *     [pricingId],
 *     { ins: ["="], between: [] },
 *     {
 *       forUpdate: true,
 *       noWait: true
 *     }
 *   );
 * } catch (error) {
 *   // Row is locked - handle conflict
 *   console.error("Resource is currently locked");
 * }
 * // SQL: SELECT * FROM pricings WHERE id = $1 FOR UPDATE NOWAIT
 *
 * @example
 * // Complex WHERE clause with OR condition
 * const result = await getData_CustomOperation(
 *   "users",
 *   ["email", "username", "status"],
 *   ["user@example.com", "john_doe", "active"],
 *   { ins: ["=", "=", "="], between: ["OR", "AND"] }
 * );
 * // SQL: SELECT * FROM users WHERE email = $1 OR username = $2 AND status = $3
 *
 * @lock-types
 * ┌──────────────────┬────────────────────────┬─────────────────────────────┬──────────────────────────────────┐
 * │ Option           │ SQL Clause             │ Behavior                    │ Use Case                         │
 * ├──────────────────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────┤
 * │ forUpdate: true  │ FOR UPDATE             │ Waits for lock,             │ Default - ensures exclusive      │
 * │                  │                        │ blocks other transactions   │ access to prevent race conditions│
 * ├──────────────────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────┤
 * │ skipLocked: true │ FOR UPDATE SKIP LOCKED │ Skips rows that are         │ Queue processing, job picking,   │
 * │                  │                        │ currently locked            │ avoid waiting in worker pools    │
 * ├──────────────────┼────────────────────────┼─────────────────────────────┼──────────────────────────────────┤
 * │ noWait: true     │ FOR UPDATE NOWAIT      │ Fails immediately if        │ Fast-fail UI, prevent hanging,   │
 * │                  │                        │ row is locked               │ user-facing operations           │
 * └──────────────────┴────────────────────────┴─────────────────────────────┴──────────────────────────────────┘
 *
 * @race-condition-prevention
 * WITHOUT LOCKING (Race Condition):
 * ```
 * Transaction A: SELECT available_seats (returns 5)
 * Transaction B: SELECT available_seats (returns 5)  ❌ Both see 5 seats!
 * Transaction A: UPDATE available_seats = 5 - 3 = 2
 * Transaction B: UPDATE available_seats = 5 - 4 = 1  ❌ Overwritten to 1!
 * Result: Sold 7 tickets but only decremented by 4 = OVERSELLING
 * ```
 *
 * WITH LOCKING (Protected):
 * ```
 * Transaction A: SELECT ... FOR UPDATE (locks row, gets 5)
 * Transaction B: SELECT ... FOR UPDATE (waits for Transaction A...)
 * Transaction A: UPDATE available_seats = 5 - 3 = 2
 * Transaction A: COMMIT (releases lock)
 * Transaction B: Now acquires lock, sees 2 seats (not 5)
 * Transaction B: Attempts UPDATE available_seats = 2 - 4 ❌ Validation fails
 * Result: Correctly prevents overselling
 * ```
 *
 * @important-notes
 * - Row locks are only held within a transaction (must use BEGIN/COMMIT)
 * - Always use forUpdate within try-catch with proper ROLLBACK handling
 * - skipLocked and noWait are mutually exclusive (skipLocked takes precedence)
 * - Locks are released when transaction commits or rolls back
 * - FOR UPDATE only works on SELECT queries, not applicable to aggregations
 * - Ensure proper indexing on locked columns for performance
 *
 * @performance-tips
 * - Lock only the rows you need (use specific WHERE conditions)
 * - Hold locks for the shortest time possible
 * - Use skipLocked for high-concurrency worker queues
 * - Use noWait for user-facing features to avoid UI hangs
 * - Consider using SELECT FOR UPDATE at the start of transaction to lock early
 *
 * @see {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE|PostgreSQL FOR UPDATE Documentation}
 */
export const getData_CustomOperation = async (
  tableName: string,
  columnName: string[],
  searchValue: string[],
  operations: {
    ins: string[];
    between: string[];
  },
  options?: {
    forUpdate?: boolean;
    columns?: string[];
    skipLocked?: boolean;
    noWait?: boolean;
  },
) => {
  const { ins, between } = operations;
  const {
    forUpdate = false,
    columns = ["*"],
    skipLocked = false,
    noWait = false,
  } = options || {};

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

  // Build SELECT clause
  const selectClause = columns.join(", ");

  // Build locking clause
  let lockClause = "";
  if (forUpdate) {
    lockClause = " FOR UPDATE";
    if (skipLocked) {
      lockClause += " SKIP LOCKED";
    } else if (noWait) {
      lockClause += " NOWAIT";
    }
  }

  const query = `SELECT ${selectClause} FROM ${tableName} WHERE ${AndOperation}${lockClause}`;

  const data = await pool.query(query, searchValue);
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
  searchValue: string[],
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
    searchValue,
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
  searchValue: string[],
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
    searchValue,
  );
  return data;
};

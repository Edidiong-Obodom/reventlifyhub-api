/**
 * Email RegEx for checking email format
 */
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Name RegEx for checking name format
 */
export const nameRegex = /^[A-Za-z\-']+$/;

/**
 * characters not allowed for regime naming
 */
export const characters_not_allowed_for_regime_naming =
  '`_- ,:;/.{}[]()<>|?"*^%#@!~+&%';

/**
 * Date Format Regular Expression Description:
 *
 * /^
 * (19\d{2}|2\d{3}|3000)-      : Matches the year part in the format YYYY. Accepts values from 1900 to 3000.
 * -                           : Matches the hyphen separator between year and month.
 * (?:0\d|1[0-2])              : Matches the month part in the format MM. Accepts values from 01 to 12.
 * -                           : Matches the hyphen separator between month and day.
 * (?:0\d|[1-2]\d|3[01])       : Matches the day part in the format DD. Accepts values from 01 to 31, depending on the month.
 * $                           : Asserts the end of the string.
 *
 * Overall, this regex is designed to validate strings representing dates in the format "YYYY-MM-DD",
 * where YYYY represents the year from 1900 to 3000, MM represents the month from 01 to 12,
 * and DD represents the day from 01 to 31 depending on the month.
 */
export const allowedDateFormat =
  /^(19\d{2}|2\d{3}|3000)-(?:0\d|1[0-2])-(?:0\d|[1-2]\d|3[01])$/;

/**
 * Time Format Regular Expression Description:
 *
 * /^
 * (?:[01]\d|2[0-3]):
 * (?:[0-5]\d):
 * (?:[0-5]\d)
 * $/
 *
 * This regular expression matches the following pattern:
 *
 * ^              : Asserts the start of the string.
 * (?:[01]\d|2[0-3]): Matches the hour part in the format HH. Accepts values from 00 to 23.
 * :              : Matches the colon separator between hours and minutes.
 * (?:[0-5]\d)    : Matches the minute part in the format MM. Accepts values from 00 to 59.
 * :              : Matches the colon separator between minutes and seconds.
 * (?:[0-5]\d)    : Matches the second part in the format SS. Accepts values from 00 to 59.
 * $              : Asserts the end of the string.
 *
 * Overall, this regex is designed to validate strings representing time in the format "HH:MM:SS",
 * where HH ranges from 00 to 23, MM and SS range from 00 to 59, and each part is separated by a colon.
 */
export const allowedTimeFormat = /^(?:[01]\d|2[0-3]):(?:[0-5]\d):(?:[0-5]\d)$/;

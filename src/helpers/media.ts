/**
 * Calculates the size of a base64-encoded string in bytes, kilobytes, and megabytes.
 *
 * @param base64 The base64-encoded string to calculate the size for.
 * @returns An object containing the size of the base64-encoded string in bytes, kilobytes, and megabytes.
 */
export const sizeChecker = (
  base64: string
): { Byte: number; KB: number; MB: number } => {
  const buffer = Buffer.from(base64.substring(base64.indexOf(",") + 1));
  const sizes = {
    Byte: buffer.length,
    KB: ((buffer.length * 6) / 8) * Math.pow(10, -3),
    MB: ((buffer.length * 6) / 8) * Math.pow(10, -6),
  };
  return sizes;
};

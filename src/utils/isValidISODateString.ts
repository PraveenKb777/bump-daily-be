/**
 * Checks if a value is a valid ISO 8601 date string.
 * @param value - The value to validate.
 * @returns true if valid ISO string, false otherwise.
 */
export function isValidISODateString(value: string): boolean {
  if (typeof value !== "string") return false;

  // Quick regex check for ISO 8601 basic format: 2025-08-12T23:30:00Z or with offset
  const isoRegex =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+\-]\d{2}:\d{2})$/;
  if (!isoRegex.test(value)) return false;

  // Full parse check
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString() === value;
}

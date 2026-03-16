/**
 * Safely convert a Date or string timestamp to ISO-8601 string.
 * postgres.js may return timestamps as Date or string depending on config.
 */
export function toISO(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

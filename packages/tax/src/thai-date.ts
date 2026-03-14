/**
 * Buddhist Era (พ.ศ.) date conversion utilities.
 *
 * The Thai calendar uses the Buddhist Era (BE), which is 543 years ahead
 * of the Common Era (CE). These utilities handle the conversion and
 * provide Thai-formatted date output.
 *
 * Story: 11.3
 */

/** Offset between Buddhist Era and Common Era. */
const BE_OFFSET = 543;

/** Thai month names (มกราคม through ธันวาคม). */
const THAI_MONTHS: readonly string[] = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const;

/** Thai abbreviated month names. */
const THAI_MONTHS_SHORT: readonly string[] = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const;

/**
 * Convert a Common Era (CE) year to a Buddhist Era (BE/พ.ศ.) year.
 *
 * @param christianYear - Year in Common Era (e.g. 2024).
 * @returns Year in Buddhist Era (e.g. 2567).
 */
export function toThaiYear(christianYear: number): number {
  if (!Number.isInteger(christianYear)) {
    throw new RangeError(
      `christianYear must be an integer, got ${String(christianYear)}`,
    );
  }
  return christianYear + BE_OFFSET;
}

/**
 * Convert a Buddhist Era (BE/พ.ศ.) year to a Common Era (CE) year.
 *
 * @param thaiYear - Year in Buddhist Era (e.g. 2567).
 * @returns Year in Common Era (e.g. 2024).
 */
export function toChristianYear(thaiYear: number): number {
  if (!Number.isInteger(thaiYear)) {
    throw new RangeError(
      `thaiYear must be an integer, got ${String(thaiYear)}`,
    );
  }
  return thaiYear - BE_OFFSET;
}

/**
 * Format a Date as a Thai date string: "DD เดือน พ.ศ. YYYY"
 *
 * @example formatThaiDate(new Date('2024-07-15')) → "15 กรกฎาคม พ.ศ. 2567"
 *
 * @param date - The date to format.
 * @returns Thai-formatted date string.
 */
export function formatThaiDate(date: Date): string {
  const day = date.getUTCDate();
  const monthIndex = date.getUTCMonth();
  const ceYear = date.getUTCFullYear();
  const beYear = toThaiYear(ceYear);
  const monthName = THAI_MONTHS[monthIndex];

  if (monthName === undefined) {
    throw new RangeError(`Invalid month index: ${String(monthIndex)}`);
  }

  return `${String(day)} ${monthName} พ.ศ. ${String(beYear)}`;
}

/**
 * Format a Date as a short Thai date string: "DD ม.ค. YYYY"
 *
 * @example formatThaiDateShort(new Date('2024-01-05')) → "5 ม.ค. 2567"
 *
 * @param date - The date to format.
 * @returns Short Thai-formatted date string.
 */
export function formatThaiDateShort(date: Date): string {
  const day = date.getUTCDate();
  const monthIndex = date.getUTCMonth();
  const ceYear = date.getUTCFullYear();
  const beYear = toThaiYear(ceYear);
  const monthName = THAI_MONTHS_SHORT[monthIndex];

  if (monthName === undefined) {
    throw new RangeError(`Invalid month index: ${String(monthIndex)}`);
  }

  return `${String(day)} ${monthName} ${String(beYear)}`;
}

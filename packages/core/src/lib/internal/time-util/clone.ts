
/**
 * Creates an exact copy of the date object.  The returned date object will
 * still be in the same conceptual time zone as the input.
 *
 * A word of warning about time zones.  Even if you use the function `toUTC`,
 * it will report its timezone as the server's local time zone.  It's a
 * weakness in the JavaScript Date object.  Conversion between time zones is
 * something that you must manage outside the date object.
 *
 * @param date
 */
export function cloneDateTime(date: Date): Date {
  return new Date(date.valueOf())
}

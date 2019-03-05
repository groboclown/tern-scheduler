

/**
 * Converts from the local computer time zone to UTC.  Note that the returned
 * Date object continues to report itself as having the local time zone,
 * but that's due to a JavaScript representation of the Date object issue,
 * not an implementation issue.
 *
 * Therefore, it is up to the user of this function to keep track of the
 * different date time zone objects.
 *
 * @param date
 */
export function toUTC(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()))
}

const SECONDS_TO_MILLS = 60 * 1000


/**
 * Converts from a UTC time zone date object to another time zone,
 * where `timezoneOffsetMinutes` represents the time, in minutes,
 * to convert FROM the timezone TO UTC.  So if the time zone is
 * "UTC+530", then that means the `timezoneOffsetMinutes` value
 * should be `-330`, and if the time zone is "UTC-600", then the
 * value should be `360`.
 *
 * @param dateUTC
 * @param timezoneOffsetMinutes
 */
export function fromUTC(dateUTC: Date, timezoneOffsetMinutes: number): Date {
  return new Date(dateUTC.valueOf() + timezoneOffsetMinutes * SECONDS_TO_MILLS)
}

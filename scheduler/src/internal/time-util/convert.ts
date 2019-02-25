

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


export function fromUTC(dateUTC: Date, timezoneOffsetMinutes: number): Date {
  return new Date(dateUTC.valueOf() + timezoneOffsetMinutes * SECONDS_TO_MILLS)
}

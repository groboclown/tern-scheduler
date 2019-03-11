import {
  isObject,
  isNumber,
} from 'util'

export interface TimeStruct {
  millis: number
  seconds: number
  minutes: number
  hours: number
  day: number
  month: number // 1-based.
  year: number

  // Note that time zone is not here.
}

/**
 * Converts a date object to a `TimeStruct`, which is suitable for encoding in a JSON object.
 *
 * @param t
 */
export function toTimeStruct(t: Date | null | undefined): TimeStruct | null | undefined {
  if (t === undefined) {
    return undefined
  }
  if (t === null) {
    return null
  }
  return {
    millis: t.getMilliseconds(),
    seconds: t.getSeconds(),
    minutes: t.getMinutes(),
    hours: t.getHours(),
    day: t.getDate(),
    month: t.getMonth() + 1,
    year: t.getFullYear(),
    // tz: t.getTimezoneOffset(),
  }
}

export function fromTimeStruct(t: TimeStruct): Date {
  return new Date(
    t.year,
    t.month - 1, // month is 0-based in Date.
    t.day,
    t.hours,
    t.minutes,
    t.seconds,
    t.millis
  )
}

export function isTimeStruct(v: any): v is TimeStruct {
  if (!v) {
    return false
  }
  return isObject(v)
    && isNumber(v.millis)
    && isNumber(v.seconds)
    && isNumber(v.minutes)
    && isNumber(v.hours)
    && isNumber(v.day)
    && isNumber(v.month)
    && isNumber(v.year)
}

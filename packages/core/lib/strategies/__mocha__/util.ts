
export interface TimeStruct {
  millis: number
  seconds: number
  minutes: number
  hours: number
  day: number
  month: number
  year: number
  // tz: number
}

export function timeStruct(t: Date | null | undefined): TimeStruct | null | undefined {
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


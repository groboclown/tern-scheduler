// import { toUTC } from "../../internal/time-util";

export const SCHEDULE_CRON_MODEL = 'cron'

export interface CronModel {
  seconds: number[]
  minutes: number[]
  hours: number[]
  daysOfMonth: number[]
  months: number[]
  daysOfWeek: number[]
}


/**
 * A parsed out range value for a cron-like experience.
 *
 * Every second where the numbers all match up indicates a fire opportunity.
 * If you want to run once an hour, then set "hours" to every hour value
 * (0-23), daysOfMonths to every value (1-31), daysOfWeek to every value
 * (0-6), minutes to 0, and seconds to 0.
 *
 * To run only weekdays at midnight, set daysOfMonth to every value, months
 * to every value, hours to 0, seconds to 0, minutes to 0, and daysOfWeek to
 * `[1,2,3,4,5]`
 */
export interface ScheduleCronModel extends CronModel {

  // offset, in minutes, from UTC for the scheduled execution.
  // For example, India is UTC+05:30, so it would be 330 (5 * 60 + 30).
  utcOffsetMinutes: number

  startAfter: Date | null
  endBy: Date | null
}


const MAXIMUM_YEAR_IN_FUTURE = 10


export function nextCronTime(model: ScheduleCronModel, now: Date): Date | null {
  if (model.endBy && now >= model.endBy) {
    return null
  }
  // Create a copy of the date, ensuring that it remains in UTC.
  let ret = new Date(now.valueOf())
  if (model.startAfter && ret < model.startAfter) {
    ret = new Date(model.startAfter.valueOf())
  }

  const farthestYear = now.getFullYear() + MAXIMUM_YEAR_IN_FUTURE

  // We're dealing with time after right now, so advance to the next
  // second.
  ret.setSeconds(ret.getSeconds() + 1)

  // The millisecond isn't specified by cron, so reset it to 0
  ret.setMilliseconds(0)

  // For cron matching, we must convert it back to the requestor's time zone
  ret.setMinutes(ret.getMinutes() + model.utcOffsetMinutes)

  // Let's first get the time right.  The time is straight-forward.
  findNext(ret.getSeconds(), model.seconds,
    (next) => {
      ret.setSeconds(next)
    }, () => {
      // Loop around to the first second, which is before
      // the current second, which means we need to "carry the one"
      // into the next minute.
      ret.setSeconds(model.seconds[0])
      ret.setMinutes(ret.getMinutes() + 1)
    }
  )
  findNext(ret.getMinutes(), model.minutes,
    (next) => {
      ret.setMinutes(next)
    }, () => {
      // Set to the first value in the range,
      // because we wrap around to that value,
      // which means we bump up the parent
      ret.setMinutes(model.minutes[0])
      ret.setHours(ret.getHours() + 1)
    }
  )
  // Hours can imply bumping up the days.  That's fine here,
  // because it means that the earliest this task can start is
  // at the bumped time the next day.
  findNext(ret.getHours(), model.hours,
    (next) => {
      ret.setHours(next)
    }, () => {
      // Set to the first value in the range,
      // because we wrap around to that value,
      // which means we bump up the parent
      ret.setHours(model.hours[0])
      ret.setDate(ret.getDate() + 1)
    }
  )

  // Now we have the complex problem of finding the next aligned
  // day.  This is really troublesome, because the combination of
  // day of month and month can lead to invalid days that will
  // never be valid.  Additionally, the mix of day of week and
  // day of month may lead to a day in the far-off future.

  // We will loop until we go beyond a reasonable time in the future
  // to look for a date.  If one isn't found beyond that time, then
  // we stop looking for one and consider the date dead.

  // Our algorithm: loop through the days in the month and the months in the
  // year until one matches our day and month parameters
  let searching = true
  while (searching && ret.getFullYear() < farthestYear) {
    // This outer loop is looping through months.
    findNext(ret.getMonth() + 1, model.months,
      (next) => {
        if (next - 1 !== ret.getMonth()) {
          // Month has changed, so reset the day of the month.
          // Month is zero based, but cron is 1 based.
          // Note that we roll the date first, so that it doesn't cause a
          // double-increment of the month.
          ret.setDate(1)
          ret.setMonth(next - 1)
        }
      }, () => {
        // move to the next year.  Changing the month means
        // resetting the day.
        // Month in date object is zero based, but cron is 1 based.
        // Note that we roll the date first, so that it doesn't cause a
        // double-increment of the month.
        ret.setDate(1)
        ret.setMonth(model.months[0] - 1)
        ret.setFullYear(ret.getFullYear() + 1)
      }
    )

    // now look for a matching day of month + day of week, starting
    // with the current day.
    let sameMonth = true
    while (sameMonth) {
      // Find the next matching day in our set.
      const res = findNext(ret.getDate(), model.daysOfMonth,
        (next) => {
          // no loop-around
          ret.setDate(next)

          // Check if this lines up with the day of the week.
          const isWeekMatch = findNext(ret.getDay(), model.daysOfWeek,
            (nextWeekDay) => nextWeekDay === ret.getDay(), () => false)
          return isWeekMatch ? 'match' : 'same'
        }, () => {
          // loop-around
          return 'inc'
        }
      )
      if (res === 'match') {
        // It all lines up.
        searching = false
        sameMonth = false
      } else if (res === 'inc') {
        sameMonth = false
      }
      // else same month, keep searching
    }
    if (searching) {
      // increment our month, reset the day.
      // This will potentially roll-over to the next year.
      ret.setDate(1)
      ret.setMonth(ret.getMonth() + 1)
    }
  }

  // Must convert the time back to UTC
  ret.setMinutes(ret.getMinutes() - model.utcOffsetMinutes)

  if (model.endBy && ret >= model.endBy || ret.getFullYear() >= farthestYear) {
    return null
  }
  return ret
}


const ALLOWED_RANGES: { [key: string]: [number, number] } = {
  seconds: [0, 59],
  minutes: [0, 59],
  hours: [0, 23],
  daysOfMonth: [1, 31],
  months: [1, 12],
  daysOfWeek: [0, 7],
}

/**
 * Convert a cron time expression (e.g. `0 *\/10 * * * *`) to the internal
 * range model.
 *
 * The ordering is:
 * 1. second (optional)
 * 1. minute
 * 1. hour
 * 1. day of month
 * 1. month
 * 1. day of week; 0 or 7 are Sunday
 *
 * @param cronExpression
 */
export function cronToModel(cronExpression: string): CronModel {
  const parts = cronExpression.split(/\s+/g)
  if (parts.length === 5) {
    // Insert the missing seconds value.
    parts.splice(0, 0, '*')
  }
  if (parts.length !== 6) {
    throw new Error(`Invalid argument: cron expression must contain 5 or 6 values; found "${cronExpression}"`)
  }
  return {
    seconds: convertToModel(parts[0], ALLOWED_RANGES.seconds),
    minutes: convertToModel(parts[1], ALLOWED_RANGES.minutes),
    hours: convertToModel(parts[2], ALLOWED_RANGES.hours),
    daysOfMonth: convertToModel(parts[3], ALLOWED_RANGES.daysOfMonth),
    months: convertToModel(parts[4], ALLOWED_RANGES.months),
    daysOfWeek: handleSundays(convertToModel(parts[5], ALLOWED_RANGES.daysOfWeek)),
  }
}


/** Exported for test purposes only */
export function convertToModel(expr: string, range: [number, number]): number[] {
  return removeDuplicates(convertStep(convertRange(replaceAsteriskWithRange(expr, range))), range)
}


function replaceAsteriskWithRange(expr: string, range: [number, number]): string {
  const pos = expr.indexOf('*')
  if (pos >= 0) {
    expr = `${expr.substring(0, pos)}${range[0]}-${range[1]}${expr.substring(pos + 1)}`
  }
  return expr
}


/** convert range values (e.g. 1-12) into comma-separated numbers. */
function convertRange(expr: string): string {
  const matchExpr = /(\d+)\-(\d+)/
  let match = matchExpr.exec(expr)
  while (match !== null && match.length > 0) {
    let nx = expr.substring(0, match.index)
    let first = parseInt(match[1], 10)
    let last = parseInt(match[2], 10)
    if (first > last) {
      const t = last
      last = first
      first = t
    }
    for (let i = first; i <= last; i++) {
      nx += String(i)
      if (i !== last) {
        nx += ','
      }
    }
    expr = nx + expr.substring(match.index + match[0].length)
    match = matchExpr.exec(expr)
  }
  return expr
}

/** at this point the expression should just be numbers, commas, and at most one slash. */
function convertStep(expr: string): number[] {
  const ret: number[] = []
  const slashPos = expr.indexOf('/')
  let step = 1
  if (slashPos >= 0) {
    step = parseInt(expr.substring(slashPos + 1), 10)
  }

  expr.split(',').forEach((part) => {
    const v = 0 + parseInt(part, 10)
    if (v % step === 0) {
      ret.push(v)
    }
  })

  return ret
}


function removeDuplicates(vals: number[], range: [number, number]): number[] {
  const ret: number[] = []
  vals.forEach((v) => {
    if (v >= range[0] && v <= range[1] && ret.indexOf(v) < 0) {
      ret.push(v)
    }
  })
  // Note: we need a numeric sort; default is a string sort.
  return ret.sort((a, b) => (0 + a) - (0 + b))
}


function handleSundays(vals: number[]): number[] {
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === 7) {
      vals[i] = 0
    }
  }
  return removeDuplicates(vals, [0, 6])
}


function findNext<T>(value: number, range: number[], found: (next: number) => T, notFound: () => T): T {
  // range MUST be sorted, so the first value that is >= value
  // is the one we want.
  for (const i of range) {
    if (i >= value) {
      return found(i)
    }
  }
  return notFound()
}

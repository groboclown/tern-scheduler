import {
  cloneDateTime,
  fromTimeStruct,
  fromUTC,
} from '../../../internal/time-util'
import {
  ScheduleCronModel
} from './api'


export const MAXIMUM_YEAR_IN_FUTURE = 10


export function nextCronTime(model: ScheduleCronModel, now: Date): Date | null {
  const startAfter = model.startAfter === null ? null : fromTimeStruct(model.startAfter)
  const endBy = model.endBy === null ? null : fromTimeStruct(model.endBy)

  // Create a copy of the date, ensuring that it remains in UTC.
  let ret = cloneDateTime(now)
  if (startAfter && ret < startAfter) {
    ret = cloneDateTime(startAfter)
  }

  const farthestYear = now.getFullYear() + MAXIMUM_YEAR_IN_FUTURE

  // We're dealing with time after right now, so advance to the next
  // second.
  ret.setSeconds(ret.getSeconds() + 1)

  // The millisecond isn't specified by cron, so reset it to 0
  ret.setMilliseconds(0)

  // Early exit for end-of-time checking
  if (endBy && now >= endBy) {
    return null
  }

  // For cron matching, we must convert it back to the requestor's time zone
  ret = fromUTC(ret, model.utcOffsetMinutes)

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
          // Check if it matches expectations.  That is, setting this
          // date to 31 when the month is Februrary will cause the date
          // to be March 3 (or 2).
          const trial = cloneDateTime(ret)
          trial.setDate(next)
          if (trial.getMonth() !== ret.getMonth()) {
            // Invalid date; it's beyond what the current month can
            // store.  So we incrment to the next month and try again.
            return 'inc'
          }

          // The date is valid for this month/year.
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

  if (endBy && ret >= endBy || ret.getFullYear() >= farthestYear) {
    return null
  }
  return ret
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

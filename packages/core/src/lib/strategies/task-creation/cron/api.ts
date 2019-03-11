import {
  TimeStruct,
  isTimeStruct,
} from '../../../internal/time-util'
import {
  isNumber,
  isObject,
  isArray,
  isString,
} from 'util'


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
export interface CronModel {
  seconds: number[]
  minutes: number[]
  hours: number[]
  daysOfMonth: number[]
  months: number[]
  daysOfWeek: number[]
}


/**
 * Full model for the cron job to describe the date range, time-zone conversion,
 * and the cron itself.
 */
export interface ScheduleCronModel extends CronModel {
  /**
   * The original cron expression entered by the user.
   */
  cronExpression: string

  /**
   * Offset, in minutes, from UTC for the scheduled execution.
   * For example, India is UTC+05:30, so it would be -330 (5 * 60 + 30).
   * The "offset" is how to adjust the date to move it to UTC.  Because
   * India tome (UTC+5:30) is 5 hours *ahead* of UTC, it must go
   * 5 hours earlier to equal UTC.  Likewise, US Eastern Standard Time
   * is UTC-5:00, so it must add 5 hours to equal UTC.
   *
   * This mechanism has one huge failing.  It means that if you live in
   * an area that is affected by daylight savings, the schedule will
   * wander by an hour depending on the time of year.  This cron
   * implementation will not attempt to reconcile that, as it gets us
   * in hairier situations that just aren't worth anyone's time (no pun
   * intended).  For example, schedules that trigger in that middle hour
   * might trigger twice, and laws of the land might change when the
   * time zone adjustment happens, which would require library updates.
   */
  utcOffsetMinutes: number

  // Storage of these times are TimeStruct to allow for easy
  // JSON storage.
  startAfter: TimeStruct | null
  endBy: TimeStruct | null
}


export function isScheduleCronModel(v: any): v is ScheduleCronModel {
  if (!v) {
    return false
  }
  return isObject(v)
    && isArray(v.seconds)
    && isArray(v.minutes)
    && isArray(v.hours)
    && isArray(v.daysOfMonth)
    && isArray(v.months)
    && isArray(v.daysOfWeek)
    && isString(v.cronExpression)
    && isNumber(v.utcOffsetMinutes)
    && (v.startAfter === null || isTimeStruct(v.startAfter))
    && (v.endBy === null || isTimeStruct(v.endBy))
}

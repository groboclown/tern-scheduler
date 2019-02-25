
export const SCHEDULE_CRON_MODEL = 'cron'
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
export interface ScheduleCronModel {
  seconds: number[]
  minutes: number[]
  hours: number[]
  daysOfMonth: number[]
  months: number[]
  daysOfWeek: number[]

  // offset, in minutes, from UTC for the scheduled execution.
  // For example, India is UTC+05:30, so it would be 330.
  utcOffsetMinutes: number
}

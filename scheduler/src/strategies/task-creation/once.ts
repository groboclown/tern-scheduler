

export const SCHEDULE_ONCE_MODEL = 'once'
/**
 * Fire the job just once, at a specific time in the future.  It is
 * up to the creator of this object to translate the time from the
 * request into UTC timezone.
 */
export interface ScheduleOnceModel {
  /**
   * Date and time to run the job, in UTC time zone.  Note that if
   * the underlying data store has its own timezone, then the data store
   * implementation must translate that to UTC.
   */
  readonly executeAt: Date
}

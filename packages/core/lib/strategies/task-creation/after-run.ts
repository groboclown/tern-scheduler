

export const SCHEDULE_AFTER_MODEL = 'after'
/**
 * Fire the event repeatedly, N seconds after the previous one
 * completes.  This requires correct integration with the job execution
 * framework to know when the job completes.
 */
export interface ScheduleAfterModel {
  // Run the next task SECONDS seconds after the previous one
  // completed.
  readonly seconds: number
}

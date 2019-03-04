
import { BaseModel, PrimaryKeyType } from './base'

export type SCHEDULE_STATE_ADD_TASK = 'add-task'
export const SCHEDULE_STATE_ADD_TASK = 'add-task'

export type SCHEDULE_STATE_START_TASK = 'start-task'
export const SCHEDULE_STATE_START_TASK = 'start-task'

export type SCHEDULE_STATE_END_TASK = 'end-task'
export const SCHEDULE_STATE_END_TASK = 'end-task'

export type SCHEDULE_STATE_PASTURE = 'pasture'
export const SCHEDULE_STATE_PASTURE = 'pasture'

export type SCHEDULE_STATE_REPAIR = 'repair'
export const SCHEDULE_STATE_REPAIR = 'repair'

export type ScheduleUpdateStateType =
  SCHEDULE_STATE_ADD_TASK | SCHEDULE_STATE_START_TASK | SCHEDULE_STATE_END_TASK |
  SCHEDULE_STATE_PASTURE | SCHEDULE_STATE_REPAIR

/**
 * Name of the instance that requests the lease, and must be unique across instances.  This can be IP + PID.
 */
export type LeaseIdType = string

export const SCHEDULE_MODEL_NAME = 'schedule'

// All date information is stored in UTC timezone.


/**
 * Basic information about the scheduled job.  Does not include information that
 * the underlying data store might need to implement the behavior.
 */
export interface ScheduledJobModel extends BaseModel {
  /**
   * Current state; non-null means that some scheduler is updating
   * the task or the schedule.
   *
   * Alterable after creation.
   */
  readonly updateState: ScheduleUpdateStateType | null
  /**
   * If the lease is to alter a task, then this field
   * is taht task's primary key.
   */
  readonly updateTaskPk: PrimaryKeyType | null

  /**
   * Is the scheduled job out to pasture, meaning that its only next state
   * is deleted.  Must be separate from the other state,
   */
  readonly pasture: boolean

  readonly displayName: string
  readonly description: string
  readonly createdOn: Date

  /**
   * What to do if a task is scheduled to run when another of the
   * same source schedule is already running.
   */
  readonly duplicateStrategy: string

  /**
   * How to handle the job engine remarking that the job must be
   * retried.
   */
  readonly retryStrategy: string

  // Job details.

  /** Registered job execution function handler name */
  readonly jobName: string

  /**
   * job context data, can be whatever, but is usually stored in JSON or
   * is the ID in the job execution framework.  Its format is depenent
   * on the job handler name.
   */
  readonly jobContext: string

  /**
   * How to determine if a task is ready to be created, and what that
   * task's expiration should be.
   */
  readonly taskCreationStrategy: string
  // a custom data storage based upon the taskCreationStrategy;
  // usually a JSON encoded object.
  readonly scheduleDefinition: string

  /**
   * Allows for linking schedules together in a directed graph.  Useful for
   * finding history of a schedule that was changed or suspended.
   */
  readonly previousSchedule: PrimaryKeyType | null
  readonly previousReason: string | null

  /**
   * Repairs may themselves be terminated early.  This keeps track of the
   * last repair state, so that resuming a repair can pick up where the
   * last one left off.
   */
  readonly repairState: string | null
}

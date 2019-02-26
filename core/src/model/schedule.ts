
import { BaseModel } from './base';

export type SCHEDULE_STATE_DISABLED = 'disabled'
/** Cannot be triggered for running. */
export const SCHEDULE_STATE_DISABLED = 'disabled'

export type SCHEDULE_STATE_ACTIVE = 'active'
/** The record is available for updates. */
export const SCHEDULE_STATE_ACTIVE = 'active'

export type SCHEDULE_STATE_UPDATING = 'updating'
/** A server marked the record as being updated */
export const SCHEDULE_STATE_UPDATING = 'updating'

export type SCHEDULE_STATE_REPAIR = 'repair'
/** The server who owns the queue encountered an error trying to start the task. */
export const SCHEDULE_STATE_REPAIR = 'repair'

export type ScheduleStateType =
  SCHEDULE_STATE_DISABLED | SCHEDULE_STATE_ACTIVE |
  SCHEDULE_STATE_UPDATING | SCHEDULE_STATE_REPAIR

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
   * Current job state.
   *
   * Alterable after creation.
   */
  readonly state: ScheduleStateType

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
}

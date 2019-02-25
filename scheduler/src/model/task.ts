
import {
  BaseModel,
  PrimaryKeyType
} from './base'


export type TASK_STATE_PENDING = 'pending'
/** The record is peding execution and is not locked. */
export const TASK_STATE_PENDING = 'pending'

export type TASK_STATE_QUEUED = 'queued'
/** A server marked the record as being updated */
export const TASK_STATE_QUEUED = 'queued'

export type TASK_STATE_STARTED = 'started'
/** A server who owns the queued record marks it as running the associated task. */
export const TASK_STATE_STARTED = 'started'

export type TASK_STATE_START_ERROR = 'start-error'
/** The server who owns the queue encountered an error trying to start the task. */
export const TASK_STATE_START_ERROR = 'start-error'

export type TASK_STATE_COMPLETE_QUEUED = 'complete-queued'
/**
 * A server is checking the completion state of the job, and can potentially
 * update the state.
 */
export const TASK_STATE_COMPLETE_QUEUED = 'complete-queued'

export type TASK_STATE_COMPLETE_ERROR = 'complete-error'
/**
 * A server who owns the queued complete record encountered an error trying to get
 * the task status.
 */
export const TASK_STATE_COMPLETE_ERROR = 'complete-error'

export type TASK_STATE_FAILED = 'failed'
/** Job execution reported result - failed execution */
export const TASK_STATE_FAILED = 'failed'

export type TASK_STATE_FAIL_RESTARTED = 'fail-restarted'
/** Job execution reported result - failed execution, job execution engine triggered a restart of the task. */
export const TASK_STATE_FAIL_RESTARTED = 'fail-restarted'

export type TASK_STATE_COMPLETED = 'completed'
/** Job execution reported result - completed execution without failure */
export const TASK_STATE_COMPLETED = 'completed'


export type TaskStateType =
  TASK_STATE_PENDING | TASK_STATE_QUEUED | TASK_STATE_STARTED |
  TASK_STATE_START_ERROR | TASK_STATE_COMPLETE_QUEUED |
  TASK_STATE_COMPLETE_ERROR | TASK_STATE_FAILED |
  TASK_STATE_FAIL_RESTARTED | TASK_STATE_COMPLETED



export const TASK_MODEL_NAME = 'task'

/**
 * A task is not directly locked.  Instead, the owning schedule is locked, which implies a lock on all
 * the non-complete tasks for that schedule.
 */
export interface TaskModel extends BaseModel {
  /** reference to the schedule that triggered this task's creation */
  readonly schedule: PrimaryKeyType

  readonly state: TaskStateType

  readonly createdOn: Date

  /** when should this task start executing */
  readonly executeAt: Date

  readonly executionJobId: string | null

  /** when the state switched to QUEUED */
  readonly executionQueued: Date | null
  /** when the state switched to STARTED */
  readonly executionStarted: Date | null
  /** when the state switched to one of the completion states */
  readonly executionFinished: Date | null

  /**
   * Which retry number this task represents.  The first run is 0.
   * When a task requires a retry, the state is set to TASK_STATE_FAIL_RESTARTED,
   * and a new task is created with an incremented retryIndex value.
   */
  readonly retryIndex: number

  /**
   * Data describing the completion of the task.  Only non-null
   * if the task is in failed, failed-restart, or completed state, and
   * the information is job execution specific.
   */
  readonly completedInfo: string | null
}

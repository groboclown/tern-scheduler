

import EventEmitter from 'events'
import StrictEventEmitter from 'strict-event-emitter-types'

import {
  TaskModel,
  ScheduledJobModel,
  TaskStateType,
  LeaseIdType,
} from '../model'
import {
  ExecutionJobId,
  JobExecutionState,
} from '../executor/types'


// The events are split by the responsibility for generating the
// event.

/**
 * All events that the scheduler inner workings generate.
 */
export interface SchedulerEvents {
  /**
   * The scheduled job was expired, either explicitly by a user request,
   * or implicitly because of a problem discovered by the scheduler.
   */
  scheduledJobDisabled: (schedule: ScheduledJobModel) => void

  /**
   * The task creation strategy dictated that a new task be created
   * for a schedule to run at some future time.
   */
  taskCreated: (task: TaskModel) => void

  /**
   * The job execution framework completed its work to start the
   * task for its associated scheduled job.  The execution framework
   * reported the unique execution ID for this execution.
   */
  taskRunning: (task: TaskModel, execId: ExecutionJobId) => void

  /**
   * The task has already been updated with the right finish state.
   */
  taskFinished: (task: TaskModel) => void

  /**
   * An attempt was made to update the task's state after completion, but
   * something else had updated the state before this scheduler could perform
   * the updates.  Most likely, this means that a different scheduler performed
   * the update.  This is more of a notification, as the system should be in
   * a valid state when this is called.
   */
  taskFinishedNotUpdated: (task: TaskModel, discoveredState: TaskStateType, finishedState: JobExecutionState) => void

  /**
   * The task could not be marked as finished because the service performing
   * the operation could not obtain the lease.  If you are running a system
   * without a shared message queue where the completion notice is sent to all
   * services, then this can mean that the scheduled job is in a bad state
   * and it needs repairs.
   */
  taskFinishedNoLease: (task: TaskModel, leaseOwner: LeaseIdType | null, finishedState: JobExecutionState) => void

  /**
   * The scheduler attempted to start a task, but a lease on the owning
   * scheduled job could not be obtained.  This is a notice message, as
   * for most situations this means another scheduler started working it
   * before the source service could get the lease.
   */
  taskStartNoLease: (task: TaskModel, leaseOwner: LeaseIdType | null) => void
}


export interface ScheduledJobPollingEvents {
  /**
   * If a scheduled job has an expired lease, it could mean that it's in
   * a broken state, and the corresponding task states must be repaired.
   */
  scheduledJobLeaseExpired: (schedule: ScheduledJobModel) => void
}



export interface TaskPollingEvents {

  /**
   * Task execution time triggered.
   */
  taskReadyToExecute: (task: TaskModel) => void

  /**
   * The task has spent too long in the "queued for execution" state, meaning that
   * the task was triggered for starting execution, but hasn't started running yet.
   *
   * "long" here is determined by the configuration.
   */
  taskQueuedLong: (task: TaskModel) => void

  /**
   * The task has spent too long in the "executiong" state, meaning that the
   * job execution framework was asked to start running the job, but it hasn't
   * yet reported that the job finished.
   */
  taskExecutingLong: (task: TaskModel) => void
}

export interface JobExecutionEvents {
  /**
   * Informative message from the job framework that the job execution completed.
   * This needs to be emitted either through a polling mechanism or by tying the
   * job framework event notification system to this event.
   *
   * This should only be triggered
   */
  jobExecutionFinished: (execId: ExecutionJobId, result: JobExecutionState) => void
}

export interface AuditEvents {
  repairStarted: (schedule: ScheduledJobModel, problem: string, when: Date) => void
}

export interface ErrorEvents {
  /**
   * Triggered when an unexpected error happens within the system.  Usually, the
   * error argument `e` is a JavaScript `Error` subtype.
   */
  generalError: (e: any) => void

  /**
   * Specific error due to the scheduled job's definition for the schedule could not
   * be used by the corresponding task creation strategy.  Any schedule that generates
   * this error is automatically put into a disabled state, because tasks cannot be
   * created from it.
   */
  invalidScheduleDefinition: (schedule: ScheduledJobModel) => void

  /**
   * Indicates a discovered internal inconsistency in the scheduler state, or an
   * error where one should not have been generated.
   */
  internalError: (e: any) => void
}

/**
 * The Messaging API allows for any underlying technology to translate its events
 * into the well-defined Tern events.  This one messaging event will be shared
 * between components to correctly send asynchronous events.
 *
 * Places where an immediate action needs to happen (not asynchronous) do not
 * use the messaging API.
 */
export interface MessagingEvents
  extends SchedulerEvents, ScheduledJobPollingEvents, TaskPollingEvents, JobExecutionEvents, AuditEvents, ErrorEvents {
}

export type SchedulerEventEmitter = StrictEventEmitter<EventEmitter, SchedulerEvents & ErrorEvents>

export type ScheduledJobPollingEventEmitter = StrictEventEmitter<EventEmitter, ScheduledJobPollingEvents & ErrorEvents>

export type TaskPollingEventEmitter = StrictEventEmitter<EventEmitter, TaskPollingEvents & ErrorEvents>

export type JobExecutionEventEmitter = StrictEventEmitter<EventEmitter, JobExecutionEvents>

export type MessagingEventEmitter = StrictEventEmitter<EventEmitter, MessagingEvents>

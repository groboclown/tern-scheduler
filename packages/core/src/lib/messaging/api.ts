

import EventEmitter from 'events'
import StrictEventEmitter from 'strict-event-emitter-types'

import {
  TaskModel,
  ScheduledJobModel,
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

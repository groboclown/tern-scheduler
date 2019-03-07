

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


export interface ScheduledJobEvents {
  scheduledJobDisabled: (schedule: ScheduledJobModel) => void

  /**
   * If a scheduled job has an expired lease, it could mean that it's in
   * a broken state, and the corresponding task states must be repaired.
   */
  scheduledJobLeaseExpired: (schedule: ScheduledJobModel) => void
}

export interface TaskEvents {
  taskCreated: (task: TaskModel) => void

  /**
   * Task execution time triggered.
   */
  taskReadyToExecute: (task: TaskModel) => void

  taskRunning: (task: TaskModel, execId: ExecutionJobId) => void

  /**
   * The task has already been updated with the right finish state.
   */
  taskFinished: (task: TaskModel) => void

  taskQueuedLong: (task: TaskModel) => void
  taskExecutingLong: (task: TaskModel) => void
}

export interface JobExecutionEvents {
  jobExecutionFinished: (execId: ExecutionJobId, result: JobExecutionState) => void
}

export interface ErrorEvents {
  generalError: (e: any) => void

  invalidScheduleDefinition: (schedule: ScheduledJobModel) => void
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
  extends ScheduledJobEvents, TaskEvents, JobExecutionEvents, ErrorEvents {
}

export type JobExecutionEventEmitter = StrictEventEmitter<EventEmitter, JobExecutionEvents>

export type MessagingEventEmitter = StrictEventEmitter<EventEmitter, MessagingEvents>

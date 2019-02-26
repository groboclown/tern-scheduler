import {
  StrategyName,
  StrategyRegistry,
} from '../api'
import {
  ScheduledJobModel
} from '../../model'

export interface TaskCreationQueue {
  action: 'queue'
  runAt: Date
}

export interface TaskCreationDisable {
  action: 'disable'
}

export type TaskCreationAction = TaskCreationDisable | TaskCreationQueue

export function isTaskCreationQueue(v: TaskCreationAction): v is TaskCreationQueue {
  return v.action === 'queue'
}

export function isTaskCreationDisable(v: TaskCreationAction): v is TaskCreationDisable {
  return v.action === 'disable'
}

export interface TaskCreationStrategyAfterFinish {
  after: 'finish'
  createFromNewSchedule: (now: Date, schedule: ScheduledJobModel) => Date
  createAfterTaskFinishes: (now: Date, schedule: ScheduledJobModel) => TaskCreationAction
}

export interface TaskCreationStrategyAfterStart {
  after: 'start'
  createFromNewSchedule: (now: Date, schedule: ScheduledJobModel) => Date
  createAfterTaskStarts: (now: Date, schedule: ScheduledJobModel) => TaskCreationAction
}

/**
 * Creates the task only after the scheduled job is first created.  After that, the
 * scheduled job is disabled.
 */
export interface TaskCreationStrategyAfterCreation {
  after: 'new'
  createFromNewSchedule: (now: Date, schedule: ScheduledJobModel) => Date
}

export type TaskCreationStrategy =
  TaskCreationStrategyAfterFinish | TaskCreationStrategyAfterStart | TaskCreationStrategyAfterCreation

export function isTaskCreationStrategyAfterFinish(v: TaskCreationStrategy): v is TaskCreationStrategyAfterFinish {
  return v.after === 'finish'
}

export function isTaskCreationStrategyAfterStart(v: TaskCreationStrategy): v is TaskCreationStrategyAfterStart {
  return v.after === 'start'
}

export function isTaskCreationStrategyAfterCreation(v: TaskCreationStrategy): v is TaskCreationStrategyAfterCreation {
  return v.after === 'new'
}



export interface TaskCreationStrategyRegistry extends StrategyRegistry<TaskCreationStrategy> {

}

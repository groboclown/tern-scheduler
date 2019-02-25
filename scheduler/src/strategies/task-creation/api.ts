import {
  StrategyName,
  StrategyRegistry,
} from '../api'
import {
  ScheduledJobModel
} from '../../model'

/**
 * Handles the task creation based on different events.
 * All dates returned must be in UTC.
 */
export interface TaskCreationStrategy {
  createFromNewSchedule(now: Date, schedule: ScheduledJobModel): Date | null
  createAfterTaskCompletes(now: Date, schedule: ScheduledJobModel): Date | null
  createOnPoll(now: Date, schedule: ScheduledJobModel): Date | null

  /** How to poll for task creation. */
  pollStrategy: StrategyName

  // TODO should retry behavior be described here?
}


export interface TaskCreationStrategyRegistry extends StrategyRegistry<TaskCreationStrategy> {

}

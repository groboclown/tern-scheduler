
import {
  StrategyRegistry,
} from './api'
import {
  TaskModel,
  ScheduledJobModel,
} from '../model'

export interface DuplicateTaskStrategy {

  /**
   * How many tasks to query for running state to see if there's a duplicate
   * running task, before starting a new one.
   *
   * TODO should this be configurable?  Should never allow capturing all of them,
   * in case of weird issues in the service.
   */
  duplicateFindCount: number

  /**
   * Returns `true` if the task should *not* run due to other running tasks.
   * 
   * @param schedule owning schedule for the tasks.
   * @param runningTasks list of running tasks in the schedule, limited to the
   *    `duplicateFindCount` amount.
   * @param taskToRun task that is expected to be run.
   */
  shouldSkip(schedule: ScheduledJobModel, runningTasks: TaskModel[], taskToRun: TaskModel): boolean
}


export interface DuplicateTaskStrategyRegistry extends StrategyRegistry<DuplicateTaskStrategy> {
}

export const ALWAYS_SKIP_DUPLICATE_TASK_NAME = 'always-skip'
export const ALWAYS_RUN_DUPLICATE_TASK_NAME = 'always-run'

export function registerAlwaysSkipDuplicateTaskStrategy(reg: DuplicateTaskStrategyRegistry): void {
  reg.register(ALWAYS_SKIP_DUPLICATE_TASK_NAME, {
    duplicateFindCount: 1,
    shouldSkip: (schedule: ScheduledJobModel, activeTasks: TaskModel[]) => {
      return activeTasks.length > 0
    },
  })
}

export function registerAlwaysRunDuplicateTaskStrategy(reg: DuplicateTaskStrategyRegistry): void {
  reg.register(ALWAYS_RUN_DUPLICATE_TASK_NAME, {
    duplicateFindCount: 1,
    shouldSkip: () => {
      return false
    },
  })
}

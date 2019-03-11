
import {
  StrategyRegistry,
} from './api'
import {
  ScheduledJobModel,
  TaskModel,
} from '../model'

/**
 * Called when the job execution framework reported an error after the job
 * fails.  If the retry strategy thinks that
 * another task should run again to retry the logic, then it returns the time
 * (in seconds) after the task's executeAt time should run.  If no retry
 * should be attempted, then it returns `null`.
 */
export type RetryTaskStrategy =
  (schedule: ScheduledJobModel, task: TaskModel, jobExecFailedReason: string) => number | null

export interface RetryTaskStrategyRegistry extends StrategyRegistry<RetryTaskStrategy> {

}


export const NO_RETRY_TASK_NAME = 'none'

export function registerNoRetryTaskStrategy(reg: RetryTaskStrategyRegistry): void {
  reg.register(NO_RETRY_TASK_NAME, () => null)
}

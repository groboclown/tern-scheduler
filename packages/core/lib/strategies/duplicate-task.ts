
import {
  StrategyRegistry,
} from './api'
import {
  TaskModel,
  ScheduledJobModel,
} from '../model'

export type DUPLICATE_TASK_SKIP_NEW = 'skip'
export const DUPLICATE_TASK_SKIP_NEW = 'skip'
export type DUPLICATE_TASK_RUN_NEW = 'run'
export const DUPLICATE_TASK_RUN_NEW = 'run'

export type DUPLICATE_TASK_DECISION =
  DUPLICATE_TASK_RUN_NEW | DUPLICATE_TASK_SKIP_NEW

export type DuplicateTaskStrategy =
  (schedule: ScheduledJobModel, activeTasks: TaskModel[], newTask: TaskModel) => DUPLICATE_TASK_DECISION


export interface DuplicateTaskStrategyRegistry extends StrategyRegistry<DuplicateTaskStrategy> {
}

export const ALWAYS_SKIP_DUPLICATE_TASK_NAME = 'always-skip'
export const ALWAYS_RUN_DUPLICATE_TASK_NAME = 'always-run'

export function registerAlwaysSkipDuplicateTaskStrategy(reg: DuplicateTaskStrategyRegistry) {
  reg.register(ALWAYS_SKIP_DUPLICATE_TASK_NAME, () => DUPLICATE_TASK_SKIP_NEW)
}

export function registerAlwaysRunDuplicateTaskStrategy(reg: DuplicateTaskStrategyRegistry) {
  reg.register(ALWAYS_RUN_DUPLICATE_TASK_NAME, () => DUPLICATE_TASK_RUN_NEW)
}


import {
  StrategyName,
  StrategyRegistry,
} from './api'
import {
  CreatePrimaryKeyStrategy,
  CreatePrimaryKeyStrategyRegistry,
} from './primary-key'
import {
  TaskCreationStrategy,
  TaskCreationStrategyRegistry,
} from './task-creation'
import {
  DuplicateTaskStrategy,
  DuplicateTaskStrategyRegistry,
} from './duplicate-task'
import {
  CreateLeaseOwnerStrategy,
  CreateLeaseOwnerStrategyRegistry,
} from './lease-owner'
import {
  CreateLeaseTimeInSecondsStrategy,
  CreateLeaseTimeInSecondsStrategyRegistry,
} from './lease-time'
import {
  GeneratePollWaitTimesStrategy,
  GeneratePollWaitTimesStrategyRegistry,
} from './poll'
import {
  RetryTaskStrategy,
  RetryTaskStrategyRegistry,
} from './retry'


export {
  StrategyName,
  StrategyRegistry,
} from './api'
export {
  CreatePrimaryKeyStrategy,
} from './primary-key'
export {
  TaskCreationStrategy,
  TaskCreationStrategyRegistry,
} from './task-creation'
export {
  CreateLeaseOwnerStrategy,
} from './lease-owner'
export {
  CreateLeaseTimeInSecondsStrategy,
} from './lease-time'
export {
  GeneratePollWaitTimesStrategy,
  RegisterPollCallback,
} from './poll'
export {
  DuplicateTaskStrategy,
  DuplicateTaskStrategyRegistry,
  DUPLICATE_TASK_RUN_NEW,
  DUPLICATE_TASK_SKIP_NEW,
} from './duplicate-task'
export {
  RetryTaskStrategy,
  RetryTaskStrategyRegistry,
} from './retry'


/**
 * Some aspects of the strategies are per-instance, while
 * others are dependent upon the context.
 */
export interface AllStrategies {
  // Per instance
  getCreatePrimaryKeyStrategy(): CreatePrimaryKeyStrategy
  getCreateLeaseOwnerStrategy(): CreateLeaseOwnerStrategy
  getCreateLeaseTimeInSecondsStrategy(): CreateLeaseTimeInSecondsStrategy

  // Per context
  getTaskCreationStrategy(name: StrategyName): TaskCreationStrategy
  getDuplicateTaskStrategy(name: StrategyName): DuplicateTaskStrategy
  getGeneratePollWaitTimesStrategy(name: StrategyName): GeneratePollWaitTimesStrategy
  getRetryTaskStrategy(name: StrategyName): RetryTaskStrategy
}

/*
export class AllStrategies implements AllStrategyRegistry{
  readonly createPrimaryKey: CreatePrimaryKeyStrategyRegistry
  readonly
}
*/


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
  CreateLeaseIdStrategy,
  CreateLeaseIdStrategyRegistry,
} from './lease-id'
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
import {
  CurrentTimeUTCStrategy,
  CurrentTimeUTCStrategyRegistry,
} from './time'



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
  CreateLeaseIdStrategy,
  addUUIDCreateLeaseIdStrategy,
} from './lease-id'
export {
  CreateLeaseTimeInSecondsStrategy,
  CreateLeaseRetryTimeInSecondsStrategy,
} from './lease-time'
export {
  GeneratePollWaitTimesStrategy,
  GeneratePollWaitTimesStrategyRegistry,
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
export {
  CurrentTimeUTCStrategy,
  CurrentTimeUTCStrategyRegistry,
  registerStandardTimeStrategy,
} from './time'


/**
 * Some aspects of the strategies are per-instance, while
 * others are dependent upon the context.
 */
export interface AllStrategies {
  // Global
  readonly createPrimaryKeyStrategy: CreatePrimaryKeyStrategy
  readonly createLeaseIdStrategy: CreateLeaseIdStrategy
  readonly createLeaseTimeInSecondsStrategy: CreateLeaseTimeInSecondsStrategy
  readonly currentTimeUTCStrategy: CurrentTimeUTCStrategy
  readonly generatePollWaitTimesStrategy: GeneratePollWaitTimesStrategy

  // Specific per context
  readonly taskCreationStrategyRegistry: TaskCreationStrategyRegistry
  readonly duplicateTaskStrategyRegistry: DuplicateTaskStrategyRegistry
  readonly retryTaskStrategyRegistry: RetryTaskStrategyRegistry
}

class StrategyRegistryImpl<T> implements StrategyRegistry<T> {
  private readonly reg: { [name: string]: T } = {}

  register(name: StrategyName, strat: T): void {
    this.reg[name] = strat
  }
  get(name: StrategyName): T {
    const ret = this.reg[name]
    if (!ret) {
      throw new Error(`No such registered strategy "${name}"`)
    }
    return ret
  }
}

export function createStrategyRegistry<T>(): StrategyRegistry<T> {
  return new StrategyRegistryImpl<T>()
}

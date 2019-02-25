
import {
  StrategyName,
  StrategyRegistry,
} from './api'
import {
  PollWaitTimes
} from './poll'

export type CreateLeaseTimeInSecondsStrategy =
  () => number


export type CreateLeaseRetryTimeInSecondsStrategy =
  () => PollWaitTimes

export interface CreateLeaseTimeInSecondsStrategyRegistry extends StrategyRegistry<CreateLeaseTimeInSecondsStrategy> {

}

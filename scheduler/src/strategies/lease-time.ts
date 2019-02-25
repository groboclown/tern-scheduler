
import {
  StrategyName,
  StrategyRegistry,
} from './api'

import {
  LeaseIdType
} from '../model'

export type CreateLeaseTimeInSecondsStrategy =
  (leaseOwner: LeaseIdType) => number


export interface CreateLeaseTimeInSecondsStrategyRegistry extends StrategyRegistry<CreateLeaseTimeInSecondsStrategy> {

}

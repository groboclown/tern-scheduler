
import {
  StrategyName,
  StrategyRegistry
} from './api'
import {
  LeaseIdType
} from '../model'

export type CreateLeaseOwnerStrategy =
  () => LeaseIdType


export interface CreateLeaseOwnerStrategyRegistry extends StrategyRegistry<CreateLeaseOwnerStrategy> {

}

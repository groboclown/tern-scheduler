
import {
  StrategyRegistry
} from '../api'
import {
  LeaseIdType
} from '../../model'

export type CreateLeaseIdStrategy =
  () => LeaseIdType


export interface CreateLeaseIdStrategyRegistry extends StrategyRegistry<CreateLeaseIdStrategy> {

}

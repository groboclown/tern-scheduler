
import {
  StrategyName,
  StrategyRegistry
} from '../api'
import {
  PrimaryKeyType,
  LeaseIdType
} from '../../model'

export type CreatePrimaryKeyStrategy = () => PrimaryKeyType

export interface CreatePrimaryKeyStrategyRegistry extends StrategyRegistry<CreatePrimaryKeyStrategy> {

}

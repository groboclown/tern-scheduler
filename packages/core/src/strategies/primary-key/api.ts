
import {
  StrategyRegistry
} from '../api'
import {
  PrimaryKeyType,
} from '../../model'

export type CreatePrimaryKeyStrategy = () => PrimaryKeyType

export interface CreatePrimaryKeyStrategyRegistry extends StrategyRegistry<CreatePrimaryKeyStrategy> {

}


import {
  UUIDConfig as UUIDConfigSrc,
  createUUIDProvider,
} from '../../internal/uuid'
import {
  CreatePrimaryKeyStrategy,
  CreatePrimaryKeyStrategyRegistry,
} from './api'

export const UUIDConfig: UUIDConfigSrc = {
  hostname: process.env.HOSTNAME || 'localhost',
}

export const UUIDCreatePrimaryKeyStrategy: CreatePrimaryKeyStrategy = createUUIDProvider(UUIDConfig)

export const UUID_PK_STRAT_NAME = 'uuid'


export function addUUIDCreatePrimaryKeyStrategy(registry: CreatePrimaryKeyStrategyRegistry): void {
  registry.register(UUID_PK_STRAT_NAME, UUIDCreatePrimaryKeyStrategy)
}

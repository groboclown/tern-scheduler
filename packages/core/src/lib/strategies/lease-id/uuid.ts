import {
  UUIDConfig as UUIDConfigSrc,
  createUUIDProvider,
} from '../../internal/uuid'
import {
  CreateLeaseIdStrategy,
  CreateLeaseIdStrategyRegistry,
} from './api'

export const UUIDConfig: UUIDConfigSrc = {
  hostname: process.env.HOSTNAME || 'localhost',
}

export const UUIDCreateLeaseIdStrategy: CreateLeaseIdStrategy = createUUIDProvider(UUIDConfig)

export const UUID_LEASE_ID_STRAT_NAME = 'uuid'


export function addUUIDCreateLeaseIdStrategy(registry: CreateLeaseIdStrategyRegistry): void {
  registry.register(UUID_LEASE_ID_STRAT_NAME, UUIDCreateLeaseIdStrategy)
}


import uuid5 from 'uuid/v5'
import {
  CreateLeaseIdStrategy,
  CreateLeaseIdStrategyRegistry,
} from './api'
import {
  LeaseIdType,
} from '../../model'

export const UUIDConfig = {
  hostname: process.env.HOSTNAME || 'localhost'
}

export const UUIDCreateLeaseIdStrategy: CreateLeaseIdStrategy = (): LeaseIdType => {
  return uuid5(UUIDConfig.hostname, uuid5.DNS)
}

export const UUID_LEASE_ID_STRAT_NAME = 'uuid'


export function addUUIDCreateLeaseIdStrategy(registry: CreateLeaseIdStrategyRegistry): void {
  registry.register(UUID_LEASE_ID_STRAT_NAME, UUIDCreateLeaseIdStrategy)
}

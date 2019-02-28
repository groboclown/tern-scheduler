
import uuid5 from 'uuid/v5'
import {
  CreateLeaseIdStrategy,
  CreateLeaseIdStrategyRegistry,
} from './api'
import {
  LeaseIdType,
} from '../../model'

export const UUIDHostname = {
  hostname:
    process.env.HOSTNAME === undefined
      ? 'localhost'
      : process.env.HOSTNAME
}

export const UUIDCreateLeaseIdStrategy: CreateLeaseIdStrategy = (): LeaseIdType => {
  return uuid5(UUIDHostname.hostname, uuid5.DNS)
}

export const UUID_PK_STRAT_NAME = 'uuid'


export function addUUIDCreateLeaseIdStrategy(registry: CreateLeaseIdStrategyRegistry): void {
  registry.register(UUID_PK_STRAT_NAME, UUIDCreateLeaseIdStrategy)
}

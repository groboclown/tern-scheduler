
import uuid5 from 'uuid/v5'
import {
  CreatePrimaryKeyStrategy,
  CreatePrimaryKeyStrategyRegistry,
} from './api'
import {
  PrimaryKeyType,
  LeaseIdType,
} from '../../model'

export const UUIDHostname = {
  hostname:
    process.env.HOSTNAME === undefined
      ? 'localhost'
      : process.env.HOSTNAME
}

export const UUIDCreatePrimaryKeyStrategy: CreatePrimaryKeyStrategy = (): PrimaryKeyType => {
  return uuid5(UUIDHostname.hostname, uuid5.DNS)
}

export const UUID_PK_STRAT_NAME = 'uuid'


export function addUUIDCreatePrimaryKeyStrategy(registry: CreatePrimaryKeyStrategyRegistry): void {
  registry.register(UUID_PK_STRAT_NAME, UUIDCreatePrimaryKeyStrategy)
}

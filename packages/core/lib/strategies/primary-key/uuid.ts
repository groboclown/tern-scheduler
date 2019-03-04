
import uuid5 from 'uuid/v5'
import {
  CreatePrimaryKeyStrategy,
  CreatePrimaryKeyStrategyRegistry,
} from './api'
import {
  PrimaryKeyType,
} from '../../model'

export const UUIDConfig = {
  hostname: process.env.HOSTNAME || 'localhost'
}

export const UUIDCreatePrimaryKeyStrategy: CreatePrimaryKeyStrategy = (): PrimaryKeyType => {
  return uuid5(UUIDConfig.hostname, uuid5.DNS)
}

export const UUID_PK_STRAT_NAME = 'uuid'


export function addUUIDCreatePrimaryKeyStrategy(registry: CreatePrimaryKeyStrategyRegistry): void {
  registry.register(UUID_PK_STRAT_NAME, UUIDCreatePrimaryKeyStrategy)
}

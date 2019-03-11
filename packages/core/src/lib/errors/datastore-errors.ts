import {
  TernError
} from './base'
import {
  PrimaryKeyType
} from '../model'

export class DataStoreError extends TernError {
  constructor(message: string) {
    super(message)

    // Error workaround fun
    this.name = DataStoreError.name
    Object.setPrototypeOf(this, DataStoreError.prototype)
  }
}

export class DuplicatePrimaryKeyError extends DataStoreError {
  constructor(public readonly modelName: string, public readonly pk: PrimaryKeyType) {
    super(`${modelName} already has primary key ${pk}`)

    // Error workaround fun
    this.name = DuplicatePrimaryKeyError.name
    Object.setPrototypeOf(this, DuplicatePrimaryKeyError.prototype)
  }
}


export class NoSuchModelError extends DataStoreError {
  constructor(public readonly modelName: string) {
    super(`No such model ${modelName}`)

    // Error workaround fun
    this.name = NoSuchModelError.name
    Object.setPrototypeOf(this, NoSuchModelError.prototype)
  }
}

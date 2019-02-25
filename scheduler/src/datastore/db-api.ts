
import {
  PrimaryKeyType,
  LeaseIdType,
  BaseModel,
  ScheduledJobModel,
  TaskModel,
} from '../model'


export interface ScheduledJobDataModel extends ScheduledJobModel {
  /**
   * Current owner of the lease, if locked.
   *
   * Alterable after creation.
   */
  readonly leaseOwner: LeaseIdType | null

  /**
   * When the lease expires.  Expiration is stored in UTC time zone.
   *
   * ALterable after creation.
   */
  readonly leaseExpires: Date | null
}

export interface TaskDataModel extends TaskModel {

}


/**
 * Simple API to allow for a "database" to back the datastore.  Implementors
 * need to create their own Database implementation.
 */

export interface Conditional {
  readonly type: string
}

export class EqualsConditional<T> implements Conditional {
  readonly type = 'eq'
  constructor(
    public readonly key: string,
    public readonly value: T
  ) { }
}

export function isEqualsConditional<T>(v: Conditional | undefined | null): v is EqualsConditional<T> {
  return (!!v) && v.type === 'eq'
}

export class AfterDateConditional implements Conditional {
  readonly type = '>date'
  constructor(
    public readonly key: string,

    // Date value is in UTC.
    public readonly after: Date
  ) { }
}

export function isAfterDateConditional(v: Conditional | undefined | null): v is AfterDateConditional {
  return (!!v) && v.type === '>date'
}

export class BeforeDateConditional implements Conditional {
  readonly type = '<date'
  constructor(
    public readonly key: string,

    // Date value is in UTC.
    public readonly before: Date
  ) { }
}

export function isBeforeDateConditional(v: Conditional | undefined | null): v is BeforeDateConditional {
  return (!!v) && v.type === '<date'
}


export class OneOfConditional<T> implements Conditional {
  readonly type = 'in'
  constructor(
    public readonly key: string,
    public readonly values: T[]
  ) { }
}

export function isOneOfConditional<T>(v: Conditional | undefined | null): v is OneOfConditional<T> {
  return (!!v) && v.type === 'in'
}


export class NullConditional implements Conditional {
  readonly type = 'null'
  constructor(public readonly key: string) { }
}

export function isNullConditional(v: Conditional | undefined | null): v is NotNullConditional {
  return (!!v) && v.type === 'null'
}


export class NotNullConditional implements Conditional {
  readonly type = 'notnull'
  constructor(public readonly key: string) { }
}

export function isNotNullConditional(v: Conditional | undefined | null): v is NotNullConditional {
  return (!!v) && v.type === 'notnull'
}


export class OrConditional implements Conditional {
  readonly type = 'or'
  constructor(
    public readonly conditionals: Conditional[],
  ) { }
}

export function isOrConditional(v: Conditional | undefined | null): v is OrConditional {
  return (!!v) && v.type === 'or'
}

export class AndConditional implements Conditional {
  readonly type = 'and'
  constructor(
    public readonly conditionals: Conditional[]
  ) { }
}

export function isAndConditional(v: Conditional | undefined | null): v is AndConditional {
  return (!!v) && v.type === 'and'
}


export interface Database {
  updateSchema(): Promise<void>

  conditionalUpdate<T extends BaseModel>(
    modelName: string,
    primaryKey: PrimaryKeyType,
    newValues: Partial<T>,
    conditional?: Conditional
  ): Promise<number>

  /**
   * Returned promise should have a `DuplicatePrimaryKeyError` problem if the
   * primary key for the value is already in the data store.  However, the
   * primary key provider that creates it should be robust enough to prevent
   * these issues.
   *
   * @param modelName
   * @param values
   */
  create<T extends BaseModel>(
    modelName: string,
    values: T
  ): Promise<void>

  find<T extends BaseModel>(
    modelName: string,
    startIndex: number,
    maximumRecordCount: number,
    conditional?: Conditional
  ): Promise<T[]>

  remove(modelName: string, primaryKey: PrimaryKeyType, conditional?: Conditional): Promise<number>
}

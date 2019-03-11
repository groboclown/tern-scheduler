
import {
  PrimaryKeyType,
  LeaseIdType,
  BaseModel,
  ScheduledJobModel,
  TaskModel,
} from '../model'


/** Marker for the data-storage version of the values. */
/* tslint:disable:no-empty-interface */
export interface DataModel extends BaseModel { }
/* tslint:enable:no-empty-interface */

export interface ScheduledJobDataModel extends ScheduledJobModel, DataModel {
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

export interface TaskDataModel extends TaskModel, DataModel {

}

/**
 * Simple API to allow for a "database" to back the datastore.  Implementors
 * need to create their own Database implementation.
 */

export interface Conditional<T extends DataModel> {
  readonly type: string
}

export class EqualsConditional<T extends DataModel, K extends keyof T> implements Conditional<T> {
  readonly type = 'eq'
  constructor(
    public readonly key: K,
    public readonly value: T[K]
  ) { }
}

export function isEqualsConditional<T extends DataModel, K extends keyof T>(
  v: Conditional<T> | undefined | null
): v is EqualsConditional<T, K> {
  return (!!v) && v.type === 'eq'
}

export class BeforeDateConditional<T extends DataModel> implements Conditional<T> {
  readonly type = '<date'
  constructor(
    public readonly key: keyof T,

    // Date value is in UTC.
    public readonly before: Date
  ) { }
}

export function isBeforeDateConditional<T extends DataModel>(v: Conditional<T> | undefined | null): v is BeforeDateConditional<T> {
  return (!!v) && v.type === '<date'
}


export class OneOfConditional<T extends DataModel, K extends keyof T> implements Conditional<T> {
  readonly type = 'in'
  constructor(
    public readonly key: K,
    public readonly values: Array<T[K]>
  ) { }
}

export function isOneOfConditional<T extends DataModel, K extends keyof T>(
  v: Conditional<T> | undefined | null
): v is OneOfConditional<T, K> {
  return (!!v) && v.type === 'in'
}

export class NullConditional<T extends DataModel> implements Conditional<T> {
  readonly type = 'null'
  constructor(
    public readonly key: keyof T
  ) { }
}

export function isNullConditional<T extends DataModel>(v: Conditional<T> | undefined | null): v is NullConditional<T> {
  return (!!v) && v.type === 'null'
}

export class NotNullConditional<T extends DataModel> implements Conditional<T> {
  readonly type = 'notnull'
  constructor(
    public readonly key: keyof T
  ) { }
}

export function isNotNullConditional<T extends DataModel>(v: Conditional<T> | undefined | null): v is NullConditional<T> {
  return (!!v) && v.type === 'notnull'
}


export class OrConditional<T extends DataModel> implements Conditional<T> {
  readonly type = 'or'
  constructor(
    public readonly conditionals: Array<Conditional<T>>
  ) { }
}

export function isOrConditional<T extends DataModel>(v: Conditional<T> | undefined | null): v is OrConditional<T> {
  return (!!v) && v.type === 'or'
}

export class AndConditional<T extends DataModel> implements Conditional<T> {
  readonly type = 'and'
  constructor(
    public readonly conditionals: Array<Conditional<T>>
  ) { }
}

export function isAndConditional<T extends DataModel>(v: Conditional<T> | undefined | null): v is AndConditional<T> {
  return (!!v) && v.type === 'and'
}


export interface DbTableController<T extends DataModel> {
  conditionalUpdate(
    primaryKey: PrimaryKeyType,
    newValues: Partial<T>,
    conditional?: Conditional<T>
  ): Promise<number>

  /**
   * Returned promise should have a `DuplicatePrimaryKeyError` problem if the
   * primary key for the value is already in the data store.  However, the
   * primary key provider that creates it should be robust enough to prevent
   * these issues.
   *
   * @param values
   */
  create(
    values: T
  ): Promise<void>

  find(
    startIndex: number,
    maximumRecordCount: number,
    conditional?: Conditional<T>
  ): Promise<T[]>

  remove(primaryKey: PrimaryKeyType, conditional?: Conditional<T>): Promise<number>
}


export interface Database {
  readonly scheduledJobTable: DbTableController<ScheduledJobDataModel>
  readonly taskTable: DbTableController<TaskDataModel>

  updateSchema(): Promise<void>
}

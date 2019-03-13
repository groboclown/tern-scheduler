import { Sequelize, ISequelizeConfig, ICreateOptions, IFindOptions } from 'sequelize-typescript'
import { UpdateOptions, DestroyOptions } from 'sequelize'
// Sequelize compatiblity
import * as BluebirdPromise from 'bluebird'

import {
  getModels, ScheduledJob, Task
} from './lib/sql-schema'

import {
  DataStore
} from '@tern-scheduler/core'

import { datastore } from '@tern-scheduler/core'
import { Op } from 'sequelize'

const DatabaseDataStore = datastore.DatabaseDataStore


export function createSqlDataStore(
  sequelize: Sequelize | ISequelizeConfig,
  logger?: (sql: string, timeMillis?: number) => void
): DataStore {
  let sq: Sequelize
  if (sequelize instanceof Sequelize) {
    sq = sequelize
  } else {
    sq = new Sequelize(sequelize)
  }
  return new DatabaseDataStore(new SqlDatabase(sq, logger))
}


class SequelizeTable<T extends ScheduledJob | Task> implements datastore.db.DbTableController<T> {
  constructor(
    private readonly logger?: (sql: string, timeMillis?: number) => void
  ) { }
  conditionalUpdate(
    primaryKey: datastore.PrimaryKeyType,
    newValues: Partial<T>,
    conditional?: datastore.db.Conditional<T>
  ): Promise<number> {
    return new Promise((resolve, reject) =>
      this._update(newValues, {
        where: toWhereClause(primaryKey, conditional),
        returning: false,
        logging: this.logger,
        benchmark: !!this.logger,
      })
        .then((args) => {
          resolve(args[0])
        })
        .catch(reject)
    )
  }

  _update(newValues: Partial<T>, options: UpdateOptions): BluebirdPromise<[number, T[]]> {
    throw new Error(`not implemented`)
  }

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
  ): Promise<void> {
    return new Promise((resolve, reject) =>
      this._create(values, {
        isNewRecord: true,

        // on MSSQL, this seems to cause the issue
        // where returning the formatted values returns
        // 0 results, so it crashes.
        // See https://github.com/sequelize/sequelize/issues/10541
        // returning: false,
        returning: true,

        logging: this.logger,
        benchmark: !!this.logger,
      })
        .then(() => { resolve() })
        .catch(reject)
    )
  }

  _create(values: T, options: ICreateOptions): BluebirdPromise<T> {
    throw new Error(`not implemented`)
  }

  find(
    startIndex: number,
    maximumRecordCount: number,
    conditional?: datastore.db.Conditional<T>
  ): Promise<T[]> {
    return new Promise((resolve, reject) =>
      this._find({
        where: conditional ? conditionalLink(conditional) : undefined,
        offset: startIndex,
        limit: maximumRecordCount,
        logging: this.logger,
        benchmark: !!this.logger,
      })
        // Returns ScheduledJob type, but we expect to return ScheduledJobDataModel.
        // But we created ScheduledJob so that it implements ScheduledJobDataModel,
        // so we're fine.
        .then((values) => { resolve((values as any[]) as T[]) })
        .catch(reject)
    )
  }

  _find(options: IFindOptions<T>): BluebirdPromise<T[]> {
    throw new Error(`not implemented`)
  }

  remove(primaryKey: datastore.PrimaryKeyType, conditional?: datastore.db.Conditional<T>): Promise<number> {
    return new Promise((resolve, reject) =>
      this._destroy({
        where: toWhereClause(primaryKey, conditional),
        limit: 1, // primary key provided, so only delete at most 1
        logging: this.logger,
        benchmark: !!this.logger,
      })
        .then((value) => { resolve(value) })
        .catch(reject)
    )
  }

  _destroy(options: DestroyOptions): BluebirdPromise<number> {
    throw new Error(`not implemented`)
  }
}


class ScheduledJobTable extends SequelizeTable<ScheduledJob> {
  constructor(logger?: (sql: string, timeMillis?: number) => void) {
    super(logger)
  }

  _update(newValues: Partial<ScheduledJob>, options: UpdateOptions): BluebirdPromise<[number, ScheduledJob[]]> {
    return ScheduledJob.update(newValues, options)
  }

  _create(values: ScheduledJob, options: ICreateOptions): BluebirdPromise<ScheduledJob> {
    return ScheduledJob.create(values, options)
  }

  _find(options: IFindOptions<ScheduledJob>): BluebirdPromise<ScheduledJob[]> {
    return ScheduledJob.findAll(options)
  }

  _destroy(options: DestroyOptions): BluebirdPromise<number> {
    return ScheduledJob.destroy(options)
  }
}


class TaskTable extends SequelizeTable<Task> {
  constructor(logger?: (sql: string, timeMillis?: number) => void) {
    super(logger)
  }

  _update(newValues: Partial<Task>, options: UpdateOptions): BluebirdPromise<[number, Task[]]> {
    return Task.update(newValues, options)
  }

  _create(values: Task, options: ICreateOptions): BluebirdPromise<Task> {
    return Task.create(values, options)
  }

  _find(options: IFindOptions<Task>): BluebirdPromise<Task[]> {
    return Task.findAll(options)
  }

  _destroy(options: DestroyOptions): BluebirdPromise<number> {
    return Task.destroy(options)
  }
}



class SqlDatabase implements datastore.db.Database {
  readonly scheduledJobTable: datastore.db.DbTableController<datastore.db.ScheduledJobDataModel>
  readonly taskTable: datastore.db.DbTableController<datastore.db.TaskDataModel>

  constructor(
    private readonly sequelize: Sequelize,
    private readonly logger?: (sql: string, timeMillis?: number) => void
  ) {
    sequelize.addModels(getModels())
    this.scheduledJobTable = new ScheduledJobTable(logger)
    this.taskTable = new TaskTable(logger)
  }

  updateSchema(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sequelize.sync({
        logging: this.logger,
      })
        .then(resolve)
        .catch(reject)
    })
  }
}


function toWhereClause<T extends datastore.BaseModel>(primaryKey: string, conditional: datastore.db.Conditional<T> | undefined): any {
  if (conditional) {
    return { [Op.and]: [{ pk: primaryKey }, conditionalLink(conditional)] }
  } else {
    return { pk: primaryKey }
  }
}

function conditionalLink<T extends datastore.BaseModel>(cnd: datastore.db.Conditional<T>): any {
  if (datastore.db.isAndConditional(cnd)) {
    const ret: any[] = []
    cnd.conditionals.forEach((c) => { ret.push(conditionalLink(c)) })
    return { [Op.and]: ret }
  }
  if (datastore.db.isOrConditional(cnd)) {
    const ret: any[] = []
    cnd.conditionals.forEach((c) => { ret.push(conditionalLink(c)) })
    return { [Op.or]: ret }
  }
  if (datastore.db.isEqualsConditional(cnd)) {
    return { [cnd.key]: { [Op.eq]: cnd.value } }
  }
  // if (datastore.db.isAfterDateConditional(cnd)) {
  //   return { [cnd.key]: { [Op.ne]: null, [Op.gt]: cnd.after } }
  // }
  if (datastore.db.isBeforeDateConditional(cnd)) {
    return { [cnd.key]: { [Op.ne]: null, [Op.lt]: cnd.before } }
  }
  if (datastore.db.isOneOfConditional(cnd)) {
    return { [cnd.key]: { [Op.in]: cnd.values } }
  }
  if (datastore.db.isNotNullConditional(cnd)) {
    return { [cnd.key]: { [Op.ne]: null } }
  }
  if (datastore.db.isNullConditional(cnd)) {
    return { [cnd.key]: { [Op.eq]: null } }
  }
  throw new Error(`Unknown conditional type ${cnd.type}`)
}

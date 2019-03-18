import {
  UpdateOptions,
  DestroyOptions,
  Sequelize,
  Options,
  FindOptions,
  Model,
} from 'sequelize'
import * as Bluebird from 'bluebird'

import {
  createScheduledJobModel,
  createTaskModel,
} from './sql-schema'

import {
  DataStore,
} from '@tern-scheduler/core'

import { datastore } from '@tern-scheduler/core'
import { Op } from 'sequelize'
import {
  ScheduledJobDataModel,
  TaskDataModel,
} from '@tern-scheduler/core/lib/lib/datastore'

const DatabaseDataStore = datastore.DatabaseDataStore


export function createSqlDataStore(
  sequelize: Sequelize | Options,
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


class SequelizeTable<T extends ScheduledJobDataModel | TaskDataModel> implements datastore.db.DbTableController<T> {
  constructor(
    protected readonly logger?: (sql: string, timeMillis?: number) => void
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

  _update(newValues: Partial<T>, options: UpdateOptions): Bluebird<[number, Model[]]> {
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
      this._create(values)
        .then(() => { resolve() })
        .catch(reject)
    )
  }

  _create(values: T): Bluebird<any> {
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

  _find(options: FindOptions): Bluebird<Model[]> {
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

  _destroy(options: DestroyOptions): Bluebird<number> {
    throw new Error(`not implemented`)
  }
}


class ScheduledJobTable extends SequelizeTable<ScheduledJobDataModel> {
  private readonly model: typeof Model & Model
  constructor(sequelize: Sequelize, logger?: (sql: string, timeMillis?: number) => void) {
    super(logger)
    this.model = createScheduledJobModel(sequelize)
  }

  _update(newValues: Partial<ScheduledJobDataModel>, options: UpdateOptions): Bluebird<[number, Model[]]> {
    return this.model.update(newValues, options)
  }

  _create(values: ScheduledJobDataModel): Bluebird<any> {
    // MS SQL has an issue with this...
    // return this.model.create(values, ...)
    return this.model
      .build(values, {
        isNewRecord: true,
      })
      .save({
        logging: this.logger,
        benchmark: !!this.logger,
      })
  }

  _find(options: FindOptions): Bluebird<Model[]> {
    return this.model.findAll(options)
  }

  _destroy(options: DestroyOptions): Bluebird<number> {
    return this.model.destroy(options)
  }
}


class TaskTable extends SequelizeTable<TaskDataModel> {
  private readonly model: typeof Model & Model
  constructor(sequelize: Sequelize, logger?: (sql: string, timeMillis?: number) => void) {
    super(logger)
    this.model = createTaskModel(sequelize)
  }

  _update(newValues: Partial<TaskDataModel>, options: UpdateOptions): Bluebird<[number, Model[]]> {
    return this.model.update(newValues, options)
  }

  _create(values: TaskDataModel): Bluebird<any> {
    // MS SQL has issues with this...
    // return this.model.create(values, options)
    return this.model
      .build(values, {
        isNewRecord: true,
      })
      .save({
        logging: this.logger,
        benchmark: !!this.logger,
      })
  }

  _find(options: FindOptions): Bluebird<Model[]> {
    return this.model.findAll(options)
  }

  _destroy(options: DestroyOptions): Bluebird<number> {
    return this.model.destroy(options)
  }
}



class SqlDatabase implements datastore.db.Database {
  readonly scheduledJobTable: datastore.db.DbTableController<ScheduledJobDataModel>
  readonly taskTable: datastore.db.DbTableController<TaskDataModel>

  constructor(
    private readonly sequelize: Sequelize,
    private readonly logger?: (sql: string, timeMillis?: number) => void
  ) {
    this.scheduledJobTable = new ScheduledJobTable(sequelize, logger)
    this.taskTable = new TaskTable(sequelize, logger)
  }

  updateSchema(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sequelize.sync({
        logging: this.logger,
      })
        .then(() => resolve())
        .catch(reject)
    })
  }
}


function toWhereClause<T extends datastore.BaseModel>(
  primaryKey: string,
  conditional: datastore.db.Conditional<T> | undefined
): any {
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

import { Sequelize, Model } from 'sequelize-typescript'

import {
  getModels, ScheduledJob, Task
} from './lib/sql-schema'

import {
  DataStore
} from '@tern-scheduler/core'

import {
  DatabaseDataStore
} from '@tern-scheduler/core/lib/datastore/db-impl'
import * as api from '@tern-scheduler/core/lib/datastore/db-api'
import { BaseModel, TASK_MODEL_NAME, SCHEDULE_MODEL_NAME } from '@tern-scheduler/core/lib/model'
import { Op } from 'sequelize';


export function createSqlDataStore(sequelize: Sequelize,
  logger?: (sql: string, timeMillis?: number) => void): DataStore {
  return new DatabaseDataStore(new SqlDatabase(sequelize, logger))
}

class SqlDatabase implements api.Database {
  private readonly models: { [name: string]: typeof Model }

  constructor(
    private readonly sequelize: Sequelize,
    private readonly logger?: (sql: string, timeMillis?: number) => void
  ) {
    sequelize.addModels(getModels())
    this.models = {
      [SCHEDULE_MODEL_NAME]: ScheduledJob,
      [TASK_MODEL_NAME]: Task,
    }
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

  conditionalUpdate<T extends BaseModel>(
    modelName: string,
    primaryKey: string,
    newValues: Partial<T>,
    conditional?: api.Conditional | undefined
  ): Promise<number> {
    const m = this.models[modelName]
    if (m) {
      return new Promise((resolve, reject) =>
        ScheduledJob.update(newValues, {
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
    throw new Error(`unknown model ${modelName}`)
  }

  create<T extends BaseModel>(modelName: string, values: T): Promise<void> {
    const m = this.models[modelName]
    if (m) {
      return new Promise((resolve, reject) =>
        ScheduledJob.create(values, {
          isNewRecord: true,
          returning: false,
          logging: this.logger,
          benchmark: !!this.logger,
        })
          .then(() => { resolve() })
          .catch(reject)
      )
    }
    throw new Error(`unknown model ${modelName}`)
  }

  find<T extends BaseModel>(
    modelName: string,
    startIndex: number,
    maximumRecordCount: number,
    conditional?: api.Conditional | undefined
  ): Promise<T[]> {
    // Due to types, this needs to be working on the real model...  Sigh.
    if (SCHEDULE_MODEL_NAME === modelName) {
      return new Promise((resolve, reject) =>
        ScheduledJob.findAll<ScheduledJob>({
          where: conditional ? conditionalLink(conditional) : undefined,
          offset: startIndex,
          limit: maximumRecordCount,
          logging: this.logger,
          benchmark: !!this.logger,
        })
          // Returns ScheduledJob type, but we expect to return ScheduledJobDataModel.
          // But we created ScheduledJob so that it implements ScheduledJobDataModel,
          // so we're fine.
          .then(values => { resolve(<T[]>(<any[]>values)) })
          .catch(reject)
      )
    }
    if (TASK_MODEL_NAME === modelName) {
      return new Promise((resolve, reject) =>
        Task.findAll<Task>({
          where: conditional ? conditionalLink(conditional) : undefined,
          offset: startIndex,
          limit: maximumRecordCount,
          logging: this.logger,
          benchmark: !!this.logger,
        })
          .then(values => { resolve(<T[]>(<any[]>values)) })
          .catch(reject)
      )
    }
    throw new Error(`unknown model ${modelName}`)
  }

  remove(
    modelName: string,
    primaryKey: string,
    conditional?: api.Conditional | undefined
  ): Promise<number> {
    const m = this.models[modelName]
    if (m) {
      m.destroy({
        where: toWhereClause(primaryKey, conditional),
        limit: 1, // primary key provided, so only delete at most 1
        logging: this.logger,
        benchmark: !!this.logger,
      })
    }
    throw new Error(`unknown model ${modelName}`)
  }
}


function toWhereClause(primaryKey: string, conditional: api.Conditional | undefined): any {
  if (conditional) {
    return { [Op.and]: [{ pk: primaryKey }, conditionalLink(conditional)] }
  } else {
    return { pk: primaryKey }
  }
}

function conditionalLink(cnd: api.Conditional): any {
  if (api.isAndConditional(cnd)) {
    const ret: any[] = []
    cnd.conditionals.forEach(c => { ret.push(conditionalLink(c)) })
    return { [Op.and]: ret }
  }
  if (api.isOrConditional(cnd)) {
    const ret: any[] = []
    cnd.conditionals.forEach(c => { ret.push(conditionalLink(c)) })
    return { [Op.or]: ret }
  }
  if (api.isEqualsConditional(cnd)) {
    return { [cnd.key]: cnd.value }
  }
  if (api.isAfterDateConditional(cnd)) {
    return { [cnd.key]: { [Op.ne]: null, [Op.gt]: cnd.after } }
  }
  if (api.isBeforeDateConditional(cnd)) {
    return { [cnd.key]: { [Op.ne]: null, [Op.lt]: cnd.before } }
  }
  if (api.isOneOfConditional(cnd)) {
    return { [cnd.key]: { [Op.in]: cnd.values } }
  }
  throw new Error(`Unknown conditional type ${cnd.type}`)
}

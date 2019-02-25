
import { DataStore } from './api'
import * as api from './db-api'
import * as impl from './db-impl'
import * as model from '../model'
import * as errors from '../errors'

const TABLES = [model.SCHEDULE_MODEL_NAME, model.TASK_MODEL_NAME]



export function createMemoryDataStore(): DataStore {
  return new impl.DatabaseDataStore(new MemoryDatabase())
}



function conditionalMatchesRecord(record: any, cnd: api.Conditional): boolean {
  if (!record) {
    return false
  }
  if (api.isAndConditional(cnd)) {
    for (let c of cnd.conditionals) {
      const res = conditionalMatchesRecord(record, c)
      if (!res) {
        return false
      }
    }
    return true
  }
  if (api.isOrConditional(cnd)) {
    for (let c of cnd.conditionals) {
      const res = conditionalMatchesRecord(record, c)
      if (res) {
        return true
      }
    }
    return false
  }
  if (api.isEqualsConditional(cnd)) {
    const val = record[cnd.key]
    return val === cnd.value
  }
  if (api.isAfterDateConditional(cnd)) {
    const val = record[cnd.key]
    return val instanceof Date && cnd.after > val
  }
  if (api.isBeforeDateConditional(cnd)) {
    const val = record[cnd.key]
    return val instanceof Date && cnd.before < val
  }
  if (api.isOneOfConditional(cnd)) {
    const val = record[cnd.key]
    return cnd.values.indexOf(val) >= 0
  }
  if (api.isNotNullConditional(cnd)) {
    const val = record[cnd.key]
    return !!val
  }
  if (api.isNullConditional(cnd)) {
    const val = record[cnd.key]
    return val === null || val === undefined
  }
  throw new Error(`Unknown conditional type ${cnd.type}`)
}


function matchesRecord<T extends model.BaseModel>(row: T, conditional: api.Conditional): boolean {
  const arow = row as any
  return conditionalMatchesRecord(arow, conditional)
}


class Table<T extends model.BaseModel> {
  readonly rows: T[] = []
  readonly pks: { [pk: string]: boolean } = {}
  constructor(readonly name: string) { }

  matches(primaryKey: model.PrimaryKeyType | null, conditional?: api.Conditional): T[] {
    return this.rows.filter(
      v => (!primaryKey || v.pk === primaryKey)
        && (!conditional || matchesRecord(v, conditional))
    )
  }

  add(row: T): boolean {
    const pk = row.pk
    if (!pk || !!(this.pks[pk])) {
      return false
    }
    this.pks[pk] = true
    this.rows.push({
      ...row
    })
    return true
  }

  remove(primaryKey: model.PrimaryKeyType, conditional?: api.Conditional): boolean {
    for (let i = 0; i < this.rows.length; i++) {
      if (this.rows[i].pk === primaryKey) {
        if (!conditional || matchesRecord(this.rows[i], conditional)) {
          this.rows.splice(i, 1)
          delete this.pks[primaryKey]
          return true
        }
        return false
      }
    }
    return false
  }
}


/**
 * An in-memory version of the data store.  Not usable for anything except local testing.
 */
export class MemoryDatabase implements api.Database {
  private readonly tables: { [name: string]: Table<any> } = {}

  // Method used by tests to get access to the underlying data.
  testAccess(modelName: string): Table<any> | undefined {
    return this.tables[modelName]
  }

  updateSchema(): Promise<void> {
    TABLES.forEach(modelName => {
      this.tables[modelName] = new Table<any>(modelName)
    })
    return Promise.resolve()
  }

  conditionalUpdate<T extends model.BaseModel>(modelName: string, primaryKey: model.PrimaryKeyType, newValues: Partial<T>, conditional?: api.Conditional): Promise<number> {
    const table = this.tables[modelName]
    if (!table) {
      return Promise.reject(new Error(`unknown model name ${modelName}`))
    }
    const nv = <any>newValues
    const matches = table.matches(primaryKey, conditional)
    matches.forEach(row => {
      // Ignore the read-only aspects, and any model restrictions...
      const r = <any>row
      Object.keys(newValues).forEach(key => {
        if (key !== 'pk') {
          r[key] = nv[key]
        }
      })
    })
    return Promise.resolve(matches.length)
  }

  create<T extends model.BaseModel>(modelName: string, values: T): Promise<void> {
    const table = this.tables[modelName]
    if (!table) {
      return Promise.reject(new errors.NoSuchModelError(modelName))
    }
    if (!table.add(values)) {
      return Promise.reject(new errors.DuplicatePrimaryKeyError(modelName, values.pk))
    }
    return Promise.resolve()
  }


  find<T extends model.BaseModel>(modelName: string, startIndex: number, maximumRecordCount: number, conditional?: api.Conditional): Promise<T[]> {
    const table = this.tables[modelName]
    if (!table) {
      return Promise.reject(new errors.NoSuchModelError(modelName))
    }
    // Need to split this up into separate calls.
    const allMatches = table.matches(null, conditional)
    allMatches.splice(0, startIndex)
    allMatches.splice(maximumRecordCount)
    return Promise.resolve(allMatches)
  }

  remove(modelName: string, primaryKey: string, conditional?: api.Conditional): Promise<number> {
    const table = this.tables[modelName]
    if (!table) {
      return Promise.reject(new errors.NoSuchModelError(modelName))
    }
    return Promise.resolve(table.remove(primaryKey, conditional) ? 1 : 0)
  }
}

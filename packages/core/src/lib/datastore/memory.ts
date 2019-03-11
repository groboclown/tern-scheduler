
import { DataStore } from './api'
import * as api from './db-api'
import * as impl from './db-impl'
import * as model from '../model'
import * as errors from '../errors'


export function createMemoryDataStore(): DataStore {
  return new impl.DatabaseDataStore(new MemoryDatabase())
}



function conditionalMatchesRecord<T extends model.BaseModel>(record: any, cnd: api.Conditional<T>): boolean {
  if (!record) {
    return false
  }
  if (api.isAndConditional(cnd)) {
    for (const c of cnd.conditionals) {
      const res = conditionalMatchesRecord(record, c)
      if (!res) {
        return false
      }
    }
    return true
  }
  if (api.isOrConditional(cnd)) {
    for (const c of cnd.conditionals) {
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
  if (api.isBeforeDateConditional(cnd)) {
    const val = record[cnd.key]
    return val instanceof Date && cnd.before < val
  }
  if (api.isNotNullConditional(cnd)) {
    return record[cnd.key] !== null
  }
  if (api.isNullConditional(cnd)) {
    return record[cnd.key] === null
  }
  if (api.isOneOfConditional(cnd)) {
    const val = record[cnd.key]
    return cnd.values.indexOf(val) >= 0
  }
  throw new Error(`Unknown conditional type ${cnd.type}`)
}


function matchesRecord<T extends model.BaseModel>(row: T, conditional: api.Conditional<T>): boolean {
  const arow = row as any
  return conditionalMatchesRecord(arow, conditional)
}

class MemTable<T extends api.DataModel> implements api.DbTableController<T> {
  readonly rows: T[] = []
  readonly pks: { [pk: string]: boolean } = {}
  constructor(readonly name: string) { }

  conditionalUpdate(
    primaryKey: model.PrimaryKeyType,
    newValues: Partial<T>,
    conditional?: api.Conditional<T>
  ): Promise<number> {
    const nv = newValues as any
    const matches = this._matches(primaryKey, conditional)
    matches.forEach((row) => {
      // Ignore the read-only aspects, and any model restrictions...
      const r = row as any
      Object.keys(newValues).forEach((key) => {
        if (key !== 'pk') {
          r[key] = nv[key]
        }
      })
    })
    return Promise.resolve(matches.length)
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
    if (!this._add(values)) {
      return Promise.reject(new errors.DuplicatePrimaryKeyError(this.name, values.pk))
    }
    return Promise.resolve()
  }

  find(
    startIndex: number,
    maximumRecordCount: number,
    conditional?: api.Conditional<T>
  ): Promise<T[]> {
    // Need to split this up into separate calls.
    const allMatches = this._matches(null, conditional)
    allMatches.splice(0, startIndex)
    allMatches.splice(maximumRecordCount)
    return Promise.resolve(allMatches)
  }

  remove(primaryKey: model.PrimaryKeyType, conditional?: api.Conditional<T>): Promise<number> {
    return Promise.resolve(this._remove(primaryKey, conditional) ? 1 : 0)
  }

  private _matches(primaryKey: model.PrimaryKeyType | null, conditional?: api.Conditional<T>): T[] {
    return this.rows.filter((v) =>
      (!primaryKey || v.pk === primaryKey)
      && (!conditional || matchesRecord(v, conditional))
    )
  }

  private _add(row: T): boolean {
    const pk = row.pk
    if (!pk || !!(this.pks[pk])) {
      return false
    }
    this.pks[pk] = true
    this.rows.push({
      ...row,
    })
    return true
  }

  private _remove(primaryKey: model.PrimaryKeyType, conditional?: api.Conditional<T>): boolean {
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
  readonly scheduledJobTable = new MemTable<api.ScheduledJobDataModel>('ScheduledJob')
  readonly taskTable = new MemTable<api.TaskDataModel>('ScheduledJob')

  updateSchema(): Promise<void> {
    return Promise.resolve()
  }
}

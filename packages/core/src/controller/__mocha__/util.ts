
import StrictEventEmitter from 'strict-event-emitter-types'
import EventEmitter from 'events'
import {
  LeaseBehavior,
} from '../schedule'
import {
  PrimaryKeyType,
  LeaseIdType,
  ScheduleStateType,
  SCHEDULE_MODEL_NAME,
  ScheduledJobModel,
} from '../../model'
import {
  CreatePrimaryKeyStrategy,
  CreateLeaseIdStrategy,
} from '../../strategies'
import {
  MemoryDatabase
} from '../../datastore/memory'
import {
  MessagingEventEmitter
} from '../../messaging'

export class ImmediateLeaseBehavior implements LeaseBehavior {
  constructor(
    readonly leaseTimeSeconds: number,
    readonly retrySecondsDelay: number[],
    readonly leaseOwnerStrategy: CreateLeaseIdStrategy
  ) { }

  registerRetryCallback(_: number, callback: () => void): void {
    // ignore the delay seconds.
    setImmediate(callback)
  }
}

export function createStaticPKStrategy(id: PrimaryKeyType): CreatePrimaryKeyStrategy {
  return () => id
}

export function getRow<T>(store: MemoryDatabase, modelName: string, pk: PrimaryKeyType): T {
  const table = store.testAccess(modelName)
  if (!table) {
    throw new Error(`no table registered named ${modelName}`)
  }
  return <T>(table.rows.filter(r => r.pk === pk)[0])
}

export function setLockState(
  store: MemoryDatabase,
  pk: PrimaryKeyType,
  leaseOwner: LeaseIdType | null,
  leaseState: ScheduleStateType,
  leaseExpires: Date | null
): ScheduledJobModel {
  // Cast row to any to allow writes
  const row: ScheduledJobModel = getRow(store, SCHEDULE_MODEL_NAME, pk)
  const arow = <any>row
  arow.leaseOwner = leaseOwner
  arow.leaseState = leaseState
  arow.leaseExpires = leaseExpires
  return row
}

export class BlockingPromise<T> {
  private innerResolve: ((x: T) => void) | null = null
  private innerReject: ((x: any) => void) | null = null
  public readonly p: Promise<T>

  constructor() {
    this.p = new Promise((res, rej) => {
      this.innerReject = rej
      this.innerResolve = res
    })
  }

  /**
   * After "next" finishes running (then), the inner promise
   * is resolved, then the returned promise's "then()" is run.
   *
   * @param value
   * @param next
   */
  resolveAfter<V>(value: T, next: Promise<V>): Promise<V> {
    return next.then((x) => {
      return new Promise<V>((resolve, reject) => {
        const tryComplete = () => {
          if (!this.innerResolve) {
            setImmediate(tryComplete)
          } else {
            this.innerResolve(value)
            resolve(x)
          }
        }
        tryComplete()
      })
    })
  }

  rejectAfter<V>(reason: any, next: Promise<V>): Promise<V> {
    return next.then((x) => {
      return new Promise<V>((resolve, reject) => {
        const tryComplete = () => {
          if (!this.innerReject) {
            setImmediate(tryComplete)
          } else {
            this.innerReject(reason)
            resolve(x)
          }
        }
        tryComplete()
      })
    })
  }
}

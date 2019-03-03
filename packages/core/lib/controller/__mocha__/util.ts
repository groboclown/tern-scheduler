
import EventEmitter from 'events'
import sinon from 'sinon'
import {
  LeaseBehavior,
} from '../schedule'
import {
  PrimaryKeyType,
  LeaseIdType,
  ScheduledJobModel,
  TaskModel,
  TaskStateType,
  ScheduleUpdateStateType,
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
import { DataStore } from '../../datastore';
import { DatabaseDataStore } from '../../datastore/db-impl';

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

export function getTaskRow(store: MemoryDatabase, pk: PrimaryKeyType): TaskModel {
  const table = store.taskTable
  return table.rows.filter(r => r.pk === pk)[0]
}

export function getScheduleRow(store: MemoryDatabase, pk: PrimaryKeyType): ScheduledJobModel {
  const table = store.scheduledJobTable
  return table.rows.filter(r => r.pk === pk)[0]
}

export function setLockState(
  store: MemoryDatabase,
  pk: PrimaryKeyType,
  leaseOwner: LeaseIdType | null,
  leaseState: ScheduleUpdateStateType | null,
  leaseExpires: Date | null
): ScheduledJobModel {
  // Cast row to any to allow writes
  const row = getScheduleRow(store, pk)
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


export class MessagingSpy {
  readonly messaging: MessagingEventEmitter = new EventEmitter()
  readonly generalError = sinon.spy()
  readonly jobExecutionFinished = sinon.spy()
  readonly taskCreated = sinon.spy()

  constructor() {
    this.messaging.on('generalError', this.generalError)
    this.messaging.on('jobExecutionFinished', this.jobExecutionFinished)
    this.messaging.on('taskCreated', this.taskCreated)
  }
}


/** Allows for injecting spies and all kinds of other behavior */
export class ProxyDataStore implements DataStore {
  readonly proxy: DataStore
  constructor(readonly db: MemoryDatabase) {
    this.proxy = new DatabaseDataStore(db)
  }

  forward(
    name: keyof DataStore,
    beforeCall?: (args: any[]) => Promise<void> | void,
    afterCall?: (result: any) => Promise<void> | void
  ): this {
    const bCall = beforeCall || ((args: any[]) => Promise.resolve())
    const aCall = afterCall || ((result: any) => Promise.resolve())
    this[name] = (...args: any[]): Promise<any> => {
      return new Promise((resolve, reject) => {
        try {
          const r = bCall(args)
          if (r instanceof Promise) {
            r.then(() => { resolve() })
            return
          }
          resolve()
        } catch (e) {
          reject(e)
        }
      })
        .then(() => (<any>this.proxy)[name].apply(this.proxy, args))
        .then(res => new Promise((resolve, reject) => {
          try {
            const r = aCall(res)
            if (r instanceof Promise) {
              r.then(() => { resolve() })
              return
            }
            resolve()
          } catch (e) {
            reject(e)
          }
        })
          .then(() => res))
    }
    return this
  }

  updateSchema(): Promise<void> {
    // No need for error stuff - it's always expecteed to run.
    return this.proxy.updateSchema()
  }

  addScheduledJobModel(model: ScheduledJobModel, leaseId: string, now: Date, leaseTimeSeconds: number): Promise<void> {
    throw new Error('unexpected call to datastore')
  }
  getScheduledJob(pk: string): Promise<ScheduledJobModel | null> {
    throw new Error('unexpected call to datastore')
  }
  pollLeaseExpiredScheduledJobs(now: Date, limit: number): Promise<ScheduledJobModel[]> {
    throw new Error('unexpected call to datastore')
  }
  getActiveScheduledJobs(pageKey: string | null, limit: number): Promise<import("../../datastore/api").Page<ScheduledJobModel>> {
    throw new Error('unexpected call to datastore')
  }
  getDisabledScheduledJobs(pageKey: string | null, limit: number): Promise<import("../../datastore/api").Page<ScheduledJobModel>> {
    throw new Error('unexpected call to datastore')
  }
  disableScheduledJob(sched: ScheduledJobModel, leaseId: string): Promise<boolean> {
    throw new Error('unexpected call to datastore')
  }
  deleteScheduledJob(sched: ScheduledJobModel): Promise<boolean> {
    throw new Error('unexpected call to datastore')
  }
  repairExpiredLeaseForScheduledJob(jobPk: string, newLeaseId: string, now: Date, leaseTimeSeconds: number): Promise<void> {
    throw new Error('unexpected call to datastore')
  }
  pollExecutableTasks(now: Date, limit: number): Promise<TaskModel[]> {
    throw new Error('unexpected call to datastore')
  }
  pollLongQueuedTasks(now: Date, beforeSeconds: number, limit: number): Promise<TaskModel[]> {
    throw new Error('unexpected call to datastore')
  }
  pollLongExecutingTasks(now: Date, beforeSeconds: number, limit: number): Promise<TaskModel[]> {
    throw new Error('unexpected call to datastore')
  }
  getExecutingTasks(pageKey: string, limit: number): Promise<import("../../datastore/api").Page<TaskModel>> {
    throw new Error('unexpected call to datastore')
  }
  getPendingTasks(pageKey: string, limit: number): Promise<import("../../datastore/api").Page<TaskModel>> {
    throw new Error('unexpected call to datastore')
  }
  getFailedTasks(pageKey: string, limit: number, since?: Date | undefined): Promise<import("../../datastore/api").Page<TaskModel>> {
    throw new Error('unexpected call to datastore')
  }
  getCompletedTasks(pageKey: string, limit: number, since?: Date | undefined): Promise<import("../../datastore/api").Page<TaskModel>> {
    throw new Error('unexpected call to datastore')
  }
  getFinishedTasks(pageKey: string, limit: number, since?: Date | undefined): Promise<import("../../datastore/api").Page<TaskModel>> {
    throw new Error('unexpected call to datastore')
  }
  addTask(task: TaskModel): Promise<void> {
    throw new Error('unexpected call to datastore')
  }
  getTask(pk: string): Promise<TaskModel | null> {
    throw new Error('unexpected call to datastore')
  }
  getTaskByExecutionJobId(execJobId: string): Promise<TaskModel | null> {
    throw new Error('unexpected call to datastore')
  }
  getActiveTasksForScheduledJob(scheduledJob: ScheduledJobModel, limit: number): Promise<TaskModel[]> {
    throw new Error('unexpected call to datastore')
  }
  markTaskQueued(task: TaskModel, now: Date): Promise<void> {
    throw new Error('unexpected call to datastore')
  }
  markTaskStarted(task: TaskModel, now: Date, executionId: string): Promise<void> {
    throw new Error('unexpected call to datastore')
  }
  markTaskStartFailed(task: TaskModel, now: Date, reason: string): Promise<void> {
    throw new Error('unexpected call to datastore')
  }
  markTaskCompleted(task: TaskModel, now: Date, info: string): Promise<void> {
    throw new Error('unexpected call to datastore')
  }
  markTaskFailed(task: TaskModel, now: Date, expectedCurrentState: TaskStateType, failedState: "complete-queued" | "complete-error" | "failed" | "fail-restarted", info: string): Promise<void> {
    throw new Error('unexpected call to datastore')
  }
  deleteFinishedTask(task: TaskModel): Promise<boolean> {
    throw new Error('unexpected call to datastore')
  }
  leaseScheduledJob(jobPk: string, updateOperation: ScheduleUpdateStateType, updateTaskPk: string | null, leaseId: string, now: Date, leaseTimeSeconds: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  releaseScheduledJobLease(leaseId: string, jobPk: string, pasture?: boolean | undefined): Promise<void> {
    throw new Error("Method not implemented.");
  }
  markLeasedScheduledJobNeedsRepair(jobPk: string, leaseId: string, now: Date): Promise<void> {
    throw new Error("Method not implemented.");
  }
}


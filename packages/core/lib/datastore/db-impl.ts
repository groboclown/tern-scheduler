
import {
  DataStore,
  Page,
} from './api'
import * as database from './db-api'
import {
  LeaseIdType,
  BaseModel,
  ScheduledJobModel,
  TaskModel,
  PrimaryKeyType,
  MODEL_PRIMARY_KEY,
} from '../model'
import {
  SCHEDULE_STATE_REPAIR,
  SCHEDULE_STATE_PASTURE,
  ScheduleUpdateStateType,
} from '../model/schedule'
import {
  TaskStateType,
  TASK_MODEL_NAME,
  TASK_STATE_PENDING,
  TASK_STATE_QUEUED,
  TASK_STATE_STARTED,
  TASK_STATE_COMPLETE_ERROR,
  TASK_STATE_FAILED,
  TASK_STATE_FAIL_RESTARTED,
  TASK_STATE_START_ERROR,
  TASK_STATE_COMPLETED,
  TASK_STATE_COMPLETE_QUEUED
} from '../model/task'
import {
  LeaseNotObtainedError,
  ScheduledJobNotFoundError,
  LeaseNotOwnedError,
  InvalidTaskStateError,
  DuplicatePrimaryKeyError
} from '../errors'
import { TaskNotFoundError } from '../errors/controller-errors';
import { ExecutionJobId } from '../executor/types';


// Column names
const SJ_UPDATE_STATE = 'updateState'
const SJ_PASTURE = 'pasture'
const SJ_LEASE_EXPIRES = 'leaseExpires'
const SJ_LEASE_OWNER = 'leaseOwner'
const TK_EXEC_AT = 'executeAt'
const TK_STATE = 'state'
const TK_EXEC_QUEUED = 'executionQueued'
const TK_EXEC_STARTED = 'executionStarted'
const TK_EX_JOB_ID = 'executionJobId'
const TK_SCHEDULE_PK = 'schedule'

export class DatabaseDataStore implements DataStore {
  constructor(private readonly db: database.Database) { }

  updateSchema(): Promise<void> {
    return this.db.updateSchema()
  }

  // ------------------------------------------------------------------------

  addScheduledJobModel(model: ScheduledJobModel, leaseId: LeaseIdType, now: Date, leaseTimeSeconds: number): Promise<void> {
    return this.db.scheduledJobTable.create({
      ...model,
      leaseOwner: leaseId,
      leaseExpires: updateDate(now, leaseTimeSeconds),
    })
  }

  getScheduledJob(pk: PrimaryKeyType): Promise<ScheduledJobModel | null> {
    return this.db.scheduledJobTable
      .find(0, 1, pkEquals(pk))
      .then(rows => {
        if (rows.length > 0) {
          return rows[0]
        }
        return null
      })
  }

  pollLeaseExpiredScheduledJobs(now: Date, limit: number): Promise<ScheduledJobModel[]> {
    return this.db.scheduledJobTable
      .find(0, limit,
        sjBeforeDate(SJ_LEASE_EXPIRES, now))
  }

  getActiveScheduledJobs(pageKey: string | null, limit: number): Promise<Page<ScheduledJobModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db.scheduledJobTable
      // Stored as a ScheduledJobDataModel, but that is a subclass, so it will conform.
      .find(startIndex, limit + 1,
        sjEquals(SJ_PASTURE, false))
      .then(rows =>
        pageResults(rows, startIndex, limit))
  }

  getDisabledScheduledJobs(pageKey: string | null, limit: number): Promise<Page<ScheduledJobModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db.scheduledJobTable
      // Stored as a ScheduledJobDataModel, but that's a subclass, so it will conform.
      .find(startIndex, limit + 1,
        sjEquals(SJ_PASTURE, true))
      .then(rows =>
        pageResults(rows, startIndex, limit))
  }

  disableScheduledJob(job: ScheduledJobModel, leaseId: LeaseIdType): Promise<boolean> {
    return this.db.scheduledJobTable
      .conditionalUpdate(job.pk, {
        pasture: true
      }, sjOr([
        // Note: this operation could run without a lease, by checking that the state is null.
        sjEquals(SJ_UPDATE_STATE, SCHEDULE_STATE_PASTURE),
        sjEquals(SJ_LEASE_OWNER, leaseId),
        sjEquals(SJ_PASTURE, false)
      ]))
      .then(updateCount => {
        if (updateCount > 0) {
          return Promise.resolve(true)
        }

        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db.scheduledJobTable
          .find(0, 1,
            sjEquals(MODEL_PRIMARY_KEY, job.pk))
          .then(jobs => {
            if (jobs.length > 0) {
              if (jobs[0].pasture) {
                return Promise.resolve(false)
              }
              return Promise.reject(new LeaseNotOwnedError(leaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires))
            } else {
              return Promise.reject(new ScheduledJobNotFoundError(job.pk))
            }
          })
      })
  }

  deleteScheduledJob(job: ScheduledJobModel): Promise<boolean> {
    // FIXME this needs more checks, to FIRST ensure it's out to pasture and not leased
    // (so that it can't change later; if it was leased, it might change to repair),
    // THEN check if there's any active tasks, and if there are, cancel delete,
    // THEN
    return this.db.scheduledJobTable
      .remove(job.pk, sjEquals(SJ_PASTURE, true))
      // Note - no query needed for failure situation.  Either it was not disabled or already deleted.
      .then(count => count > 0)
  }


  stealExpiredLeaseForScheduledJob(
    jobPk: PrimaryKeyType, newLeaseId: LeaseIdType,
    now: Date, leaseTimeSeconds: number
  ): Promise<void> {
    const expires = updateDate(now, leaseTimeSeconds)
    return this.db.scheduledJobTable
      .conditionalUpdate(jobPk, {
        updateState: SCHEDULE_STATE_REPAIR,
        leaseOwner: newLeaseId,
        leaseExpires: expires,
      }, sjAnd([
        // Any
        sjNotNull(SJ_UPDATE_STATE),
        sjBeforeDate(SJ_LEASE_EXPIRES, now),
      ]))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db.scheduledJobTable
          .find(0, 1,
            pkEquals(jobPk))
          .then(jobs => {
            if (jobs.length > 0) {
              return Promise.reject(new LeaseNotObtainedError(newLeaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires))
            } else {
              return Promise.reject(new ScheduledJobNotFoundError(jobPk))
            }
          })
      })
  }


  leaseScheduledJob(
    jobPk: PrimaryKeyType,
    updateOperation: ScheduleUpdateStateType,
    updateTaskPk: PrimaryKeyType | null,
    leaseId: LeaseIdType, now: Date, leaseTimeSeconds: number
  ): Promise<void> {
    const expires = updateDate(now, leaseTimeSeconds)
    return this.db.scheduledJobTable
      .conditionalUpdate(jobPk, {
        updateState: updateOperation,
        updateTaskPk: updateTaskPk,
        leaseOwner: leaseId,
        leaseExpires: expires,
      },
        // No check if the lease is expired.  Only take the lease if the state is not updating.
        // Also don't check if the job is out to pasture; tasks can still require updates after
        // the job is disabled.
        sjNull(SJ_UPDATE_STATE)
      )
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db.scheduledJobTable
          .find(0, 1,
            pkEquals(jobPk))
          .then(jobs => {
            if (jobs.length > 0) {
              return Promise.reject(new LeaseNotObtainedError(leaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires))
            } else {
              return Promise.reject(new ScheduledJobNotFoundError(jobPk))
            }
          })
      })
  }

  releaseScheduledJobLease(
    leaseId: string,
    jobPk: PrimaryKeyType,
    pasture?: boolean
  ): Promise<void> {
    let updates: Partial<database.ScheduledJobDataModel>;
    // Passing "undefined" in the partial value means that the key is still
    // in the object.
    if (pasture !== undefined) {
      updates = {
        updateState: null,
        updateTaskPk: null,
        leaseOwner: null,
        leaseExpires: null,
        pasture,
      }
    } else {
      updates = {
        updateState: null,
        updateTaskPk: null,
        leaseOwner: null,
        leaseExpires: null,
      }
    }

    return this.db.scheduledJobTable
      .conditionalUpdate(jobPk, updates,
        sjAnd([
          // No need for checking if the state is pastured or not.
          // It could be leased while pastured.
          sjNotNull(SJ_UPDATE_STATE),
          sjEquals(SJ_LEASE_OWNER, leaseId)
        ]))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db.scheduledJobTable
          .find(0, 1,
            pkEquals(jobPk))
          .then(jobs => {
            if (jobs.length > 0) {
              return Promise.reject(new LeaseNotOwnedError(leaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires))
            } else {
              return Promise.reject(new ScheduledJobNotFoundError(jobPk))
            }
          })
      })
  }

  repairExpiredLeaseForScheduledJob(
    jobPk: PrimaryKeyType,
    newLeaseId: LeaseIdType,
    now: Date,
    leaseTimeSeconds: number
  ): Promise<void> {
    const expires = updateDate(now, leaseTimeSeconds)
    return this.db.scheduledJobTable
      .conditionalUpdate(jobPk, {
        updateState: SCHEDULE_STATE_REPAIR,
        // Set the lease owner to something that couldn't be leased
        leaseOwner: newLeaseId,
        // It expired in the past.
        leaseExpires: expires
      }, sjAnd([
        sjNotNull(SJ_UPDATE_STATE),
        sjBeforeDate(SJ_LEASE_EXPIRES, now)
      ]))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db.scheduledJobTable
          .find(0, 1,
            pkEquals(jobPk))
          .then(jobs => {
            if (jobs.length > 0) {
              return Promise.reject(new LeaseNotObtainedError(newLeaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires))
            } else {
              return Promise.reject(new ScheduledJobNotFoundError(jobPk))
            }
          })
      })
  }


  markLeasedScheduledJobNeedsRepair(jobPk: PrimaryKeyType, leaseId: LeaseIdType, now: Date): Promise<void> {
    return this.db.scheduledJobTable
      .conditionalUpdate(jobPk, {
        leaseExpires: now
      }, sjAnd([
        sjNotNull(SJ_UPDATE_STATE),
        sjEquals(SJ_LEASE_OWNER, leaseId)
      ]))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db.scheduledJobTable
          .find(0, 1,
            pkEquals(jobPk))
          .then(jobs => {
            if (jobs.length > 0) {
              return Promise.reject(new LeaseNotOwnedError('<unknown>', jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires))
            } else {
              return Promise.reject(new ScheduledJobNotFoundError(jobPk))
            }
          })
      })
  }


  // ------------------------------------------------------------------------


  pollExecutableTasks(now: Date, limit: number): Promise<TaskModel[]> {
    return this.db.taskTable
      .find(0, limit, new database.AndConditional([
        tkBeforeDate(TK_EXEC_AT, now),
        tkEquals(TK_STATE, TASK_STATE_PENDING),
      ]))
  }

  pollLongQueuedTasks(now: Date, beforeSeconds: number, limit: number): Promise<TaskModel[]> {
    const before = updateDate(now, -beforeSeconds)
    return this.db.taskTable
      .find(0, limit, new database.AndConditional([
        tkBeforeDate(TK_EXEC_QUEUED, before),
        tkEquals(TK_STATE, TASK_STATE_QUEUED),
      ]))
  }

  pollLongExecutingTasks(now: Date, beforeSeconds: number, limit: number): Promise<TaskModel[]> {
    const before = updateDate(now, -beforeSeconds)
    return this.db.taskTable
      .find(0, limit, new database.AndConditional([
        tkBeforeDate(TK_EXEC_STARTED, before),
        tkEquals(TK_STATE, TASK_STATE_STARTED),
      ]))
  }

  getExecutingTasks(pageKey: string | null, limit: number): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db.taskTable
      .find(startIndex, limit + 1,
        tkEquals(TK_STATE, TASK_STATE_STARTED))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  getPendingTasks(pageKey: string | null, limit: number): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db.taskTable
      .find(startIndex, limit + 1,
        tkEquals(TK_STATE, TASK_STATE_PENDING))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  getFailedTasks(pageKey: string | null, limit: number, since?: Date | undefined): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db.taskTable
      .find(startIndex, limit + 1,
        tkOneOf(TK_STATE, [
          TASK_STATE_COMPLETE_ERROR,
          TASK_STATE_FAILED,
          TASK_STATE_FAIL_RESTARTED,
          TASK_STATE_START_ERROR,
        ]))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  getCompletedTasks(pageKey: string | null, limit: number, since?: Date | undefined): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db.taskTable
      .find(startIndex, limit + 1,
        tkEquals(TK_STATE, TASK_STATE_COMPLETED))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  getFinishedTasks(pageKey: string | null, limit: number, since?: Date | undefined): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db.taskTable
      .find(startIndex, limit + 1,
        tkOneOf(TK_STATE, [
          TASK_STATE_COMPLETE_ERROR,
          TASK_STATE_FAILED,
          TASK_STATE_FAIL_RESTARTED,
          TASK_STATE_START_ERROR,
          TASK_STATE_COMPLETED,
        ]))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  addTask(task: TaskModel): Promise<void> {
    const data: database.TaskDataModel = {
      ...task
    }
    return this.db.taskTable
      .create(data)
  }

  getTask(pk: PrimaryKeyType): Promise<TaskModel | null> {
    return this.db.taskTable
      .find(0, 1,
        pkEquals(pk))
      .then(rows => rows.length > 0 ? rows[0] : null)
  }

  getTaskByExecutionJobId(execJobId: ExecutionJobId): Promise<TaskModel | null> {
    return this.db.taskTable
      .find(0, 2,
        tkEquals(TK_EX_JOB_ID, execJobId))
      .then(rows => {
        if (rows.length <= 0) {
          return null
        }
        if (rows.length === 1) {
          return rows[0]
        }
        throw new DuplicatePrimaryKeyError(TASK_MODEL_NAME, execJobId)
      })
  }

  getActiveTasksForScheduledJob(scheduledJob: ScheduledJobModel, limit: number): Promise<TaskModel[]> {
    return this.db.taskTable
      .find(0, limit, new database.AndConditional([
        tkEquals(TK_SCHEDULE_PK, scheduledJob.pk),
        tkOneOf('state', [
          TASK_STATE_PENDING,
          TASK_STATE_QUEUED,
          TASK_STATE_STARTED,
        ])
      ]))
  }

  markTaskQueued(task: TaskModel, now: Date): Promise<void> {
    return this.markTaskState(task.pk, TASK_STATE_PENDING, TASK_STATE_QUEUED, {
      executionQueued: now,
    })
  }

  markTaskStarted(task: TaskModel, now: Date, executionId: string): Promise<void> {
    return this
      .markTaskState(task.pk, TASK_STATE_QUEUED, TASK_STATE_STARTED, {
        executionStarted: now,
        executionJobId: executionId
      })
  }

  markTaskStartFailed(task: TaskModel, now: Date, reason: string): Promise<void> {
    return this.markTaskState(task.pk, TASK_STATE_QUEUED, TASK_STATE_START_ERROR, {
      executionStarted: now,
      completedInfo: reason,
    })
  }

  markTaskCompleted(task: TaskModel, now: Date, info: string): Promise<void> {
    return this.markTaskState(task.pk, TASK_STATE_STARTED, TASK_STATE_COMPLETED, {
      executionFinished: now,
      completedInfo: info,
    })

  }

  markTaskFailed(task: TaskModel, now: Date, expectedCurrentState: TaskStateType,
    failedState: TASK_STATE_COMPLETE_ERROR | TASK_STATE_COMPLETE_QUEUED |
      TASK_STATE_FAILED | TASK_STATE_FAIL_RESTARTED,
    info: string
  ): Promise<void> {
    return this.markTaskState(task.pk, expectedCurrentState, failedState, {
      executionFinished: now,
      completedInfo: info
    })
  }

  private markTaskState(pk: PrimaryKeyType,
    expectedCurrentState: TaskStateType, newState: TaskStateType, extra?: Partial<database.TaskDataModel>
  ): Promise<void> {
    const extraData = extra || {}
    return this.db.taskTable
      .conditionalUpdate(pk, {
        ...extraData,
        state: newState,
      }, tkAnd([
        tkEquals(TK_STATE, expectedCurrentState)
      ]))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db.taskTable
          .find(0, 1,
            pkEquals(pk))
          .then(tasks => {
            if (tasks.length > 0) {
              return Promise.reject(new InvalidTaskStateError(tasks[0], newState, expectedCurrentState))
            } else {
              return Promise.reject(new TaskNotFoundError(pk))
            }
          })
      })
  }

  deleteFinishedTask(task: TaskModel): Promise<boolean> {
    return this.db.taskTable
      .remove(task.pk,
        tkOneOf(TK_STATE, [
          TASK_STATE_COMPLETE_ERROR,
          TASK_STATE_FAILED,
          TASK_STATE_FAIL_RESTARTED,
          TASK_STATE_START_ERROR,
          TASK_STATE_COMPLETED,
        ]))
      .then(count => count > 0)
  }
}




function updateDate(date: Date, increaseSeconds: number): Date {
  const ret = new Date(date.valueOf())
  ret.setSeconds(ret.getSeconds() + increaseSeconds)
  return ret
}

function parsePageKey(pageKey: string | null): number {
  const startIndexMaybe = Number(pageKey || '0')
  return startIndexMaybe === NaN ? 0 : startIndexMaybe
}

function pageResults<T extends BaseModel>(rows: T[], startIndex: number, limit: number): Page<T> {
  if (rows.length > limit) {
    rows.slice(1)
    return {
      nextPageKey: (startIndex + limit).toString(),
      estimatedCount: startIndex + rows.length,
      pageSize: limit,
      page: rows,
    }
  }
  return {
    nextPageKey: null,
    estimatedCount: startIndex + rows.length,
    pageSize: limit,
    page: rows,
  }
}

function pkEquals(pk: PrimaryKeyType): database.EqualsConditional<database.DataModel, 'pk'> {
  return new database.EqualsConditional(MODEL_PRIMARY_KEY, pk)
}

function sjAnd(
  conditionals: database.Conditional<database.ScheduledJobDataModel>[]
): database.AndConditional<database.ScheduledJobDataModel> {
  return new database.AndConditional<database.ScheduledJobDataModel>(conditionals)
}

function sjOr(
  conditionals: database.Conditional<database.ScheduledJobDataModel>[]
): database.OrConditional<database.ScheduledJobDataModel> {
  return new database.OrConditional<database.ScheduledJobDataModel>(conditionals)
}

function sjEquals<K extends keyof database.ScheduledJobDataModel>(
  key: K,
  value: database.ScheduledJobDataModel[K]
): database.EqualsConditional<database.ScheduledJobDataModel, K> {
  return new database.EqualsConditional<database.ScheduledJobDataModel, K>(key, value)
}

function sjBeforeDate(
  key: keyof database.ScheduledJobDataModel,
  when: Date
): database.BeforeDateConditional<database.ScheduledJobDataModel> {
  return new database.BeforeDateConditional<database.ScheduledJobDataModel>(key, when)
}

function sjNotNull(
  key: keyof database.ScheduledJobDataModel
): database.NotNullConditional<database.ScheduledJobDataModel> {
  return new database.NotNullConditional<database.ScheduledJobDataModel>(key)
}

function sjNull(
  key: keyof database.ScheduledJobDataModel
): database.NullConditional<database.ScheduledJobDataModel> {
  return new database.NullConditional<database.ScheduledJobDataModel>(key)
}


function tkAnd(
  conditionals: database.Conditional<database.TaskDataModel>[]
): database.AndConditional<database.TaskDataModel> {
  return new database.AndConditional<database.TaskDataModel>(conditionals)
}

function tkEquals<K extends keyof database.TaskDataModel>(
  key: K,
  value: database.TaskDataModel[K]
): database.EqualsConditional<database.TaskDataModel, K> {
  return new database.EqualsConditional<database.TaskDataModel, K>(key, value)
}

function tkBeforeDate(
  key: keyof database.TaskDataModel,
  value: Date
): database.BeforeDateConditional<database.TaskDataModel> {
  return new database.BeforeDateConditional<database.TaskDataModel>(key, value)
}

function tkOneOf<K extends keyof database.TaskDataModel>(
  key: K,
  values: (database.TaskDataModel[K])[]
): database.OneOfConditional<database.TaskDataModel, K> {
  return new database.OneOfConditional<database.TaskDataModel, K>(key, values)
}

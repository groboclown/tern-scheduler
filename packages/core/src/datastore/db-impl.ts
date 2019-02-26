
import {
  DataStore,
  Page,
} from './api'
import {
  Database,
  AndConditional,
  OrConditional,
  EqualsConditional,
  BeforeDateConditional,
  OneOfConditional,
  ScheduledJobDataModel,
  TaskDataModel,
} from './db-api'
import {
  LeaseIdType,
  BaseModel,
  ScheduledJobModel,
  TaskModel,
  PrimaryKeyType,
  MODEL_PRIMARY_KEY,
} from '../model'
import {
  SCHEDULE_MODEL_NAME,
  SCHEDULE_STATE_ACTIVE,
  SCHEDULE_STATE_DISABLED,
  SCHEDULE_STATE_REPAIR,
  SCHEDULE_STATE_UPDATING,
} from '../model/schedule'
import {
  TASK_MODEL_NAME, TASK_STATE_PENDING, TASK_STATE_QUEUED, TASK_STATE_STARTED, TASK_STATE_COMPLETE_ERROR, TASK_STATE_FAILED, TASK_STATE_FAIL_RESTARTED, TASK_STATE_START_ERROR, TASK_STATE_COMPLETED, TaskStateType, TASK_STATE_COMPLETE_QUEUED
} from '../model/task'
import { LeaseNotObtainedError, ScheduledJobNotFoundError, LeaseNotOwnedError, InvalidTaskStateError, DuplicatePrimaryKeyError } from '../errors'
import { TaskNotFoundError } from '../errors/controller-errors';
import { ExecutionJobId } from '../executor/types';



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

export class DatabaseDataStore implements DataStore {
  constructor(private readonly db: Database) { }

  updateSchema(): Promise<void> {
    return this.db.updateSchema()
  }

  // ------------------------------------------------------------------------

  addScheduledJobModel(model: ScheduledJobModel, leaseId: LeaseIdType, now: Date, leaseTimeSeconds: number): Promise<void> {
    return this.db.create<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, {
      ...model,
      leaseOwner: leaseId,
      leaseExpires: updateDate(now, leaseTimeSeconds)
    })
  }

  getJob(pk: PrimaryKeyType): Promise<ScheduledJobModel | null> {
    return this.db
      .find<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, 0, 1, new EqualsConditional(MODEL_PRIMARY_KEY, pk))
      .then(rows => {
        if (rows.length > 0) {
          return rows[0]
        }
        return null
      })
  }

  pollLeaseExpiredScheduledJobs(now: Date, limit: number): Promise<ScheduledJobModel[]> {
    return this.db.find(SCHEDULE_MODEL_NAME, 0, limit, new BeforeDateConditional('leaseExpires', now))
  }

  getActiveScheduledJobs(pageKey: string | null, limit: number): Promise<Page<ScheduledJobModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db
      // Stored as a ScheduledJobDataModel, but that's a subclass, so it will conform.
      .find<ScheduledJobModel>(SCHEDULE_MODEL_NAME, startIndex, limit + 1,
        new OneOfConditional('state', [SCHEDULE_STATE_ACTIVE, SCHEDULE_STATE_REPAIR, SCHEDULE_STATE_UPDATING]))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  getDisabledScheduledJobs(pageKey: string | null, limit: number): Promise<Page<ScheduledJobModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db
      // Stored as a ScheduledJobDataModel, but that's a subclass, so it will conform.
      .find<ScheduledJobModel>(SCHEDULE_MODEL_NAME, startIndex, limit + 1,
        new EqualsConditional('state', SCHEDULE_STATE_DISABLED))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  disableScheduledJob(job: ScheduledJobModel, leaseId: LeaseIdType): Promise<boolean> {
    return this.db
      .conditionalUpdate<ScheduledJobModel>(SCHEDULE_MODEL_NAME, job.pk, {
        state: SCHEDULE_STATE_ACTIVE
      }, new OrConditional([
        new EqualsConditional('state', SCHEDULE_STATE_ACTIVE),
        new EqualsConditional('leaseOwner', leaseId),
      ]))
      .then(updateCount => {
        if (updateCount > 0) {
          return Promise.resolve(true)
        }

        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db
          .find<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, 0, 1,
            new EqualsConditional(MODEL_PRIMARY_KEY, job.pk))
          .then(jobs => {
            if (jobs.length > 0) {
              if (jobs[0].state === SCHEDULE_STATE_DISABLED) {
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
    return this.db
      .remove(SCHEDULE_MODEL_NAME, job.pk, new EqualsConditional('state', SCHEDULE_STATE_DISABLED))
      // Note - no query needed for failure situation.  Either it was not disabled or already deleted.
      .then(count => count > 0)
  }


  stealExpiredLeaseForScheduledJob(
    jobPk: PrimaryKeyType, newLeaseId: LeaseIdType,
    now: Date, leaseTimeSeconds: number
  ): Promise<void> {
    const expires = updateDate(now, leaseTimeSeconds)
    return this.db
      .conditionalUpdate<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, jobPk, {
        state: SCHEDULE_STATE_REPAIR,
        leaseOwner: newLeaseId,
        leaseExpires: expires,
      }, new AndConditional([
        new EqualsConditional('state', SCHEDULE_STATE_UPDATING),
        new BeforeDateConditional('leaseExpires', now),
      ]))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db
          .find<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, 0, 1, new EqualsConditional(MODEL_PRIMARY_KEY, jobPk))
          .then(jobs => {
            if (jobs.length > 0) {
              return Promise.reject(new LeaseNotObtainedError(newLeaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires))
            } else {
              return Promise.reject(new ScheduledJobNotFoundError(jobPk))
            }
          })
      })
  }


  leaseScheduledJob(jobPk: PrimaryKeyType, leaseId: LeaseIdType, now: Date, leaseTimeSeconds: number): Promise<void> {
    const expires = updateDate(now, leaseTimeSeconds)
    return this.db
      .conditionalUpdate<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, jobPk, {
        state: SCHEDULE_STATE_UPDATING,
        leaseOwner: leaseId,
        leaseExpires: expires,
        // No check if the lease is expired.
      }, new EqualsConditional('state', SCHEDULE_STATE_ACTIVE))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db
          .find<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, 0, 1, new EqualsConditional(MODEL_PRIMARY_KEY, jobPk))
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
    releaseState: SCHEDULE_STATE_DISABLED | SCHEDULE_STATE_ACTIVE
  ): Promise<void> {
    return this.db
      .conditionalUpdate<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, jobPk, {
        state: releaseState,
        leaseOwner: null,
        leaseExpires: null
      }, new AndConditional([
        new EqualsConditional('state', SCHEDULE_STATE_UPDATING),
        new EqualsConditional('leaseOwner', leaseId)
      ]))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db
          .find<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, 0, 1, new EqualsConditional(MODEL_PRIMARY_KEY, jobPk))
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
    return this.db
      .conditionalUpdate<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, jobPk, {
        state: SCHEDULE_STATE_DISABLED,
        // Set the lease owner to something that couldn't be leased
        leaseOwner: newLeaseId,
        // It expired in the past.
        leaseExpires: expires
      }, new AndConditional([
        new OneOfConditional('state', [SCHEDULE_STATE_UPDATING, SCHEDULE_STATE_REPAIR]),
        new BeforeDateConditional('leaseExpires', now)
      ]))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db
          .find<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, 0, 1, new EqualsConditional(MODEL_PRIMARY_KEY, jobPk))
          .then(jobs => {
            if (jobs.length > 0) {
              return Promise.reject(new LeaseNotObtainedError(newLeaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires))
            } else {
              return Promise.reject(new ScheduledJobNotFoundError(jobPk))
            }
          })
      })
  }


  markLeasedScheduledJobNeedsRepair(jobPk: PrimaryKeyType, now: Date): Promise<void> {
    return this.db
      .conditionalUpdate<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, jobPk, {
        leaseExpires: now
      }, new EqualsConditional('state', SCHEDULE_STATE_UPDATING))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db
          .find<ScheduledJobDataModel>(SCHEDULE_MODEL_NAME, 0, 1, new EqualsConditional(MODEL_PRIMARY_KEY, jobPk))
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
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, 0, limit, new AndConditional([
        new BeforeDateConditional('executeAt', now),
        new EqualsConditional('state', TASK_STATE_PENDING),
      ]))
  }

  pollLongQueuedTasks(now: Date, beforeSeconds: number, limit: number): Promise<TaskModel[]> {
    const before = updateDate(now, -beforeSeconds)
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, 0, limit, new AndConditional([
        new BeforeDateConditional('executionQueued', before),
        new EqualsConditional('state', TASK_STATE_QUEUED),
      ]))
  }

  pollLongExecutingTasks(now: Date, beforeSeconds: number, limit: number): Promise<TaskModel[]> {
    const before = updateDate(now, -beforeSeconds)
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, 0, limit, new AndConditional([
        new BeforeDateConditional('executionStarted', before),
        new EqualsConditional('state', TASK_STATE_STARTED),
      ]))
  }

  getExecutingTasks(pageKey: string, limit: number): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, startIndex, limit + 1,
        new EqualsConditional('state', TASK_STATE_STARTED))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  getPendingTasks(pageKey: string, limit: number): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, startIndex, limit + 1,
        new EqualsConditional('state', TASK_STATE_PENDING))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  getFailedTasks(pageKey: string, limit: number, since?: Date | undefined): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, startIndex, limit + 1,
        new OneOfConditional('state', [
          TASK_STATE_COMPLETE_ERROR,
          TASK_STATE_FAILED,
          TASK_STATE_FAIL_RESTARTED,
          TASK_STATE_START_ERROR,
        ]))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  getCompletedTasks(pageKey: string, limit: number, since?: Date | undefined): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, startIndex, limit + 1,
        new EqualsConditional('state', TASK_STATE_COMPLETED))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  getFinishedTasks(pageKey: string, limit: number, since?: Date | undefined): Promise<Page<TaskModel>> {
    const startIndex = parsePageKey(pageKey)
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, startIndex, limit + 1,
        new OneOfConditional('state', [
          TASK_STATE_COMPLETE_ERROR,
          TASK_STATE_FAILED,
          TASK_STATE_FAIL_RESTARTED,
          TASK_STATE_START_ERROR,
          TASK_STATE_COMPLETED,
        ]))
      .then(rows => pageResults(rows, startIndex, limit))
  }

  addTask(task: TaskModel): Promise<void> {
    const data: TaskDataModel = {
      ...task
    }
    return this.db.create(TASK_MODEL_NAME, data)
  }

  getTask(pk: PrimaryKeyType): Promise<TaskModel | null> {
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, 0, 1, new EqualsConditional(MODEL_PRIMARY_KEY, pk))
      .then(rows => rows.length > 0 ? rows[0] : null)
  }

  getTaskByExecutionJobId(execJobId: ExecutionJobId): Promise<TaskModel | null> {
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, 0, 2, new EqualsConditional('executionJobId', execJobId))
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
    return this.db
      .find<TaskDataModel>(TASK_MODEL_NAME, 0, limit, new AndConditional([
        new EqualsConditional('schedule', scheduledJob.pk),
        new OneOfConditional('state', [
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
    expectedCurrentState: TaskStateType, newState: TaskStateType, extra?: Partial<TaskDataModel>
  ): Promise<void> {
    const extraData = extra || {}
    return this.db
      .conditionalUpdate<TaskDataModel>(TASK_MODEL_NAME, pk, {
        ...extraData,
        state: newState,
      }, new AndConditional([
        new EqualsConditional('state', expectedCurrentState)
      ]))
      .then(count => {
        if (count > 0) {
          return Promise.resolve()
        }
        // Failure triggers can cause the query to not look right if someone steals
        // the state between the initial conditional update and this query.
        return this.db
          .find<TaskDataModel>(TASK_MODEL_NAME, 0, 1, new EqualsConditional(MODEL_PRIMARY_KEY, pk))
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
    return this.db
      .remove(TASK_MODEL_NAME, task.pk, new OneOfConditional('state', [
        TASK_STATE_COMPLETE_ERROR,
        TASK_STATE_FAILED,
        TASK_STATE_FAIL_RESTARTED,
        TASK_STATE_START_ERROR,
        TASK_STATE_COMPLETED,
      ]))
      .then(count => count > 0)
  }
}

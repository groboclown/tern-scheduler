
import {
  createScheduledJob,
  runUpdateInLease,
  LeaseBehavior,
  NewScheduledJob,
} from './schedule'

import {
  ScheduledJobModel,
  TaskModel,
  TASK_STATE_PENDING,
  TaskStateType,
  TASK_STATE_STARTED,
  TASK_STATE_COMPLETE_ERROR,
} from '../model'

import {
  MessagingEventEmitter,
} from '../messaging'

import {
  DataStore
} from '../datastore'

import {
  CreatePrimaryKeyStrategy,
  TaskCreationStrategy,
  RetryTaskStrategy,
  DuplicateTaskStrategyRegistry,
  DUPLICATE_TASK_SKIP_NEW,
  CurrentTimeUTCStrategy,
} from '../strategies'
import { TaskCreationStrategyRegistry } from '../strategies/task-creation'
import {
  StartJob,
  ExecutionJobId,
  isJobExecutionStateCompleted,
  JobExecutionState,
  isJobExecutionStateFailed,
  isJobExecutionStateRunning
} from '../executor/types';
import { ScheduledJobNotFoundError, LeaseNotObtainedError, TernError } from '../errors';
import { logDebug, logInfo } from '../logging';
import { TaskNotFoundError } from '../errors/controller-errors';
import { RetryTaskStrategyRegistry } from '../strategies/retry';


// Functions that still perform at the controller level, but need to coordinate the operation
// between the different model parts.

/**
 * Creates the schedule and the first task.
 */
export function createSchedule(
  store: DataStore,
  schedule: NewScheduledJob,
  leaseBehavior: LeaseBehavior,
  now: Date,
  createPrimaryKeyStrat: CreatePrimaryKeyStrategy,
  taskCreationReg: TaskCreationStrategyRegistry,
  messaging: MessagingEventEmitter
): Promise<ScheduledJobModel> {
  return createScheduledJob(
    store,
    schedule,
    now,
    leaseBehavior,
    createPrimaryKeyStrat,
    (job) => {
      messaging.emit('scheduledJobEnabled', job)
      const taskRunDate = taskCreationReg.get(schedule.taskCreationStrategy)
        .createFromNewSchedule(now, job)
      if (taskRunDate) {
        const task: TaskModel = {
          pk: createPrimaryKeyStrat(),
          schedule: job.pk,
          createdOn: now,
          state: TASK_STATE_PENDING,
          executeAt: taskRunDate,
          executionJobId: null,
          retryIndex: 0,
          completedInfo: null,
          executionQueued: null,
          executionStarted: null,
          executionFinished: null,
        }
        return store.addTask(task)
          .then(() => {
            messaging.emit('taskCreated', task)
            return job
          })
      } else {
        return Promise.resolve(job)
      }
    })
}

/**
 * Called when the schedule's execution time is reached.  This will handle
 * leasing the schedule, duplicate detection & handling,
 */
export function createTaskForSchedule(
  store: DataStore,
  schedule: ScheduledJobModel,
  now: Date,
  lease: LeaseBehavior,
  taskRunDate: Date,
  createPrimaryKeyStrat: CreatePrimaryKeyStrategy,
  retryIndex: number,
  duplicateTaskReg: DuplicateTaskStrategyRegistry,
  messaging: MessagingEventEmitter
): Promise<void> {
  const task: TaskModel = {
    pk: createPrimaryKeyStrat(),
    schedule: schedule.pk,
    createdOn: now,
    state: TASK_STATE_PENDING,
    executeAt: taskRunDate,
    executionJobId: null,
    retryIndex: retryIndex,
    completedInfo: null,
    executionQueued: null,
    executionStarted: null,
    executionFinished: null,
  }
  return runUpdateInLease(store, schedule.pk, now, lease, (job, leaseId) => {
    // Check the job execution time again; if it's after date,
    // then that means between the time when we found the job and obtained the
    // lease and started running this function, something else did this work.
    if (job.lastTaskExecutionDate && job.lastTaskExecutionDate > now) {
      // Something else did it for us.
      logInfo('createTaskForSchedule', `Attempted to create task for ${schedule.pk}, but it was created for us`)
      return
    }

    // Check if there's another task already in queued or running state
    // for this schedule.  If so, run duplicate strategy logic.
    return store
      .getActiveTasksForScheduledJob(job, 10)
      .then(activeTasks => {
        if (activeTasks.length > 0) {
          const strat = duplicateTaskReg.get(job.duplicateStrategy)(job, activeTasks, task)
          if (strat === DUPLICATE_TASK_SKIP_NEW) {
            logInfo('createTaskForSchedule', `Skipping creating new task for schedule ${schedule.pk}`)
            return Promise.resolve()
          }
        }
        // Otherwise, create the task
        return store.addTask(task)
          // and set the job's execute value to the task run date.
          .then(() => store.setNextTaskExecutionTime(leaseId, job.pk, taskRunDate))
          .then(() => {
            messaging.emit('taskCreated', task)
          })
      })
  })
}

/**
 * Starting at the point where a task is ready to run, this tries to
 * obtain a lease on the owning strategy then put the task into the
 * right state.  It also kicks off the job.
 */
export function startTask(
  store: DataStore,
  task: TaskModel,
  leaseBehavior: LeaseBehavior,
  now: Date,
  startJob: StartJob,
  currentTimeUTC: CurrentTimeUTCStrategy,
): Promise<void> {
  return runUpdateInLease(store, task.schedule, now, leaseBehavior, (job) =>
    store
      .markTaskQueued(task, now)
      .then(() =>
        startJob(task.pk, job.jobName, job.jobContext)
          .catch(e =>
            // request to start the job failed.  This is different than the
            // job just failing; this means the job framework just couldn't
            // perform its actions.
            store
              .markTaskStartFailed(task, currentTimeUTC(), String(e))
              .then(() => Promise.reject(e))
          )
      )
      .then((execId) =>
        store
          .markTaskStarted(task, currentTimeUTC(), execId)
      )
  )
}


/**
 * Handles task completion when the job framework reports completion.  Includes retry
 * behavior if the job failed.
 *
 * @param store
 * @param execJobId
 * @param result
 * @param now
 * @param messaging
 */
export function taskFinished(
  store: DataStore,
  execJobId: ExecutionJobId,
  result: JobExecutionState,
  now: Date,
  lease: LeaseBehavior,
  retryReg: RetryTaskStrategyRegistry,
  duplicateTaskReg: DuplicateTaskStrategyRegistry,
  messaging: MessagingEventEmitter
): Promise<void> {
  if (isJobExecutionStateRunning(result)) {
    throw new TernError(`invalid job execution state ${JSON.stringify(result)}`)
  }
  return store
    .getTaskByExecutionJobId(execJobId)
    .then(task => {
      if (!task) {
        throw new TaskNotFoundError(execJobId)
      }
      return runUpdateInLease(store, task.schedule, now, lease, (job, leaseId) => {
        if (isJobExecutionStateFailed(result)) {
          return store
            .markTaskFailed(task, now, TASK_STATE_STARTED, TASK_STATE_COMPLETE_ERROR, result.result)
            .then(() => {
              // Handle retry
              const retryInSeconds = retryReg.get(job.retryStrategy)(job, task, result.result)
              if (retryInSeconds === null) {
                // no retry
                return Promise.resolve(null)
              }
              // Queue a retry task
              // Retry time is based on when the task was discovered to be failed,
              // which is the "now" time.
              const retryTime = new Date(now.valueOf())
              retryTime.setSeconds(retryTime.getSeconds() + retryInSeconds)
              // Check if there's another task already in queued or running state
              // for this schedule.  If so, run duplicate strategy logic.
              return store
                .getActiveTasksForScheduledJob(job, 10)
                .then(activeTasks => {
                  if (activeTasks.length > 0) {
                    const strat = duplicateTaskReg.get(job.duplicateStrategy)(job, activeTasks, task)
                    if (strat === DUPLICATE_TASK_SKIP_NEW) {
                      logInfo('createTaskForSchedule', `Skipping creating new task on retry for schedule ${job.pk}`)
                      return Promise.resolve(null)
                    }
                  }
                  // Otherwise, create the task
                  return store.addTask(task)
                    // and set the job's execute value to the task run date.
                    .then(() => store.setNextTaskExecutionTime(leaseId, job.pk, retryTime))
                    .then(() => {
                      messaging.emit('taskCreated', task)
                      return task
                    })
                })
            })
        } else if (isJobExecutionStateCompleted(result)) {
          return store
            .markTaskCompleted(task, now, result.result)
            .then(() => task)
        } else {
          return Promise.reject(new TernError(`invalid job execution state ${JSON.stringify(result)}`))
        }
      })
    })
    .then(task => {
      if (task) {
        messaging.emit('taskFinished', task)
      }
    })
}


export function enableSchedule(
  store: DataStore,
  schedule: ScheduledJobModel,
  now: Date,
  leaseBehavior: LeaseBehavior,
  messaging: MessagingEventEmitter
): Promise<boolean> {
  return store.enableScheduledJob(schedule)
    .then(enabled => {
      if (enabled) {
        messaging.emit('scheduledJobEnabled', schedule)
      }
      return enabled
    })
}


export function disableSchedule(
  store: DataStore,
  schedule: ScheduledJobModel,
  now: Date,
  leaseBehavior: LeaseBehavior,
  messaging: MessagingEventEmitter
): Promise<boolean> {
  return runUpdateInLease(store, schedule.pk, now, leaseBehavior, (job, leaseId) => {
    return store.disableScheduledJob(job, leaseId)
      .then(disabled => {
        if (disabled) {
          messaging.emit('scheduledJobDisabled', job)
        }
        return disabled
      })
  })
}

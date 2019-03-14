// This file is the heart of the scheduler.
// It is complex logic that needs to be right.

import {
  createScheduledJobAlone,
  runUpdateInLease,
  LeaseBehavior,
  NewScheduledJob,
  LeaseExitStateValue,
} from './schedule'

import {
  ScheduledJobModel,
  TaskModel,
  TASK_STATE_PENDING,
  TASK_STATE_STARTED,
  TASK_STATE_COMPLETE_ERROR,
  PrimaryKeyType,
  TASK_STATE_QUEUED,
  TASK_STATE_FAILED,
} from '../model'

import {
  MessagingEventEmitter,
} from '../messaging'

import {
  DataStore
} from '../datastore'

import {
  CreatePrimaryKeyStrategy,
  DuplicateTaskStrategyRegistry,
  DUPLICATE_TASK_SKIP_NEW,
  CurrentTimeUTCStrategy,
} from '../strategies'
import { TaskCreationStrategyRegistry } from '../strategies/task-creation'
import {
  StartJob,
  ExecutionJobId,
  JobExecutionState,
  isJobExecutionStateCompleted,
  isJobExecutionStateFailed,
  isJobExecutionStateRunning,
  isJobExecutionStateDidNotStart,
} from '../executor/types'
import { TernError } from '../errors'
import { logInfo } from '../logging'
import { TaskNotFoundError, InvalidJobExecutionStatusError } from '../errors/controller-errors'
import { RetryTaskStrategyRegistry } from '../strategies/retry'
import {
  isTaskCreationStrategyAfterStart,
  isTaskCreationDisable,
  isTaskCreationStrategyAfterFinish
} from '../strategies/task-creation/api'
import { SCHEDULE_STATE_START_TASK, SCHEDULE_STATE_END_TASK, SCHEDULE_STATE_PASTURE } from '../model/schedule'
import { cloneDateTime } from '../internal/time-util'


/**
 * How many tasks to query for running state to see if there's a duplicate
 * running task, before starting a new one.
 *
 * TODO should this be configurable?  Should never allow capturing all of them,
 * in case of weird issues in the service.
 */
const DUPLICATE_RUNNING_TASK_LIMIT = 100

// Functions that still perform at the controller level, but need to coordinate the operation
// between the different model parts.

/**
 * Creates the schedule and the first task.
 */
export function createScheduledJob(
  store: DataStore,
  schedule: NewScheduledJob,
  leaseBehavior: LeaseBehavior,
  now: Date,
  createPrimaryKeyStrat: CreatePrimaryKeyStrategy,
  taskCreationReg: TaskCreationStrategyRegistry,
  messaging: MessagingEventEmitter
): Promise<PrimaryKeyType> {
  return createScheduledJobAlone(
    store,
    schedule,
    now,
    leaseBehavior,
    createPrimaryKeyStrat,
    messaging,
    (sched, createdTaskPk) => {
      const strat = taskCreationReg.get(schedule.taskCreationStrategy)
      const taskRunDate = strat.createFromNewSchedule(now, sched)
      // A task item must always be created when a scheduled job is
      // created.
      const task: TaskModel = {
        pk: createdTaskPk,
        schedule: sched.pk,
        createdOn: now,
        state: TASK_STATE_PENDING,
        executeAt: taskRunDate,
        executionJobId: null,
        retryIndex: 0,
        completedInfo: null,
        executionQueued: null,
        executionStarted: null,
        executionFinished: null,
        nextTimeoutCheck: null,
      }
      // No need to check for duplicates here, because this is the first
      // task for this scheduled job.
      return store.addTask(task)
        .then(() => {
          messaging.emit('taskCreated', task)
          return { value: sched.pk }
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
  retryReg: RetryTaskStrategyRegistry,
  taskCreationReg: TaskCreationStrategyRegistry,
  duplicateTaskReg: DuplicateTaskStrategyRegistry,
  currentTimeUTC: CurrentTimeUTCStrategy,
  createPrimaryKeyStrat: CreatePrimaryKeyStrategy,
  // TODO include timeouts for queue and run times?  Should those be part of the job framework (thus the messaging)?
  messaging: MessagingEventEmitter
): Promise<void> {
  return runUpdateInLease(store,
    SCHEDULE_STATE_START_TASK, task.schedule, task.pk,
    now, leaseBehavior, messaging, (sched): Promise<LeaseExitStateValue<null>> =>
      store
        // FIXME should the queue call include the set long time check date?
        .markTaskQueued(task, now)
        .then(() =>
          // The only external system we're allowed to call while we have a
          // scheduled job lease.
          startJob(task.pk, sched.jobName, sched.jobContext)
            .catch((e) =>
              // request to start the job failed.  This is different than the
              // job just failing; this means the job framework just couldn't
              // perform its actions.  This should disable the schedule and
              // not attempt to start another task.
              store
                .markTaskStartFailed(task, currentTimeUTC(), String(e))
                // Rejecting causes this to skip next task creation.
                .then(() => Promise.reject(e))
            )
        )
        .then((execStatus) => {
          if (isJobExecutionStateCompleted(execStatus)) {
            // Do not emit events, because it was entirely self-contained.
            return store
              .markTaskStarted(task, currentTimeUTC(), execStatus.jobId)
              .then(() =>
                store.markTaskCompleted(task, currentTimeUTC(), execStatus.result || ''))
          }
          if (isJobExecutionStateDidNotStart(execStatus)) {
            // Do not emit events, because it was entirely self-contained.
            // Do not retry the failure, because this disables the job.
            return store.markTaskStartFailed(task, currentTimeUTC(), execStatus.result || '')
          }
          if (isJobExecutionStateFailed(execStatus)) {
            // Do not emit events, because it was entirely self-contained.

            return store
              .markTaskStarted(task, currentTimeUTC(), execStatus.jobId)
              .then(() =>
                store.markTaskFailed(
                  task,
                  currentTimeUTC(),
                  TASK_STATE_QUEUED,
                  TASK_STATE_FAILED,
                  execStatus.result || ''
                ))
              .then(() =>
                retryTask(
                  store,
                  now,
                  sched,
                  task,
                  execStatus.result || '',
                  createPrimaryKeyStrat,
                  retryReg,
                  taskCreationReg,
                  duplicateTaskReg,
                  messaging
                ))
              .then(() => { })
          }
          if (isJobExecutionStateRunning(execStatus)) {
            return store
              .markTaskStarted(task, currentTimeUTC(), execStatus.jobId)
              .then(() => {
                messaging.emit('taskRunning', task, execStatus.jobId)
              })
          }
          return Promise.reject(new InvalidJobExecutionStatusError(execStatus))
        })
        .then(() => {
          // Check the job if a new task should be created.
          const taskCreationStrategy = taskCreationReg.get(sched.taskCreationStrategy)
          if (isTaskCreationStrategyAfterStart(taskCreationStrategy)) {
            const taskRunDate = taskCreationStrategy.createAfterTaskStarts(now, sched)
            if (isTaskCreationDisable(taskRunDate)) {
              return Promise.resolve({ value: null, pasture: true })
            }
            // FIXME duplicate check
            return addTaskDuplicateCheck(
              store,
              now,
              sched,
              task,
              taskRunDate.runAt,
              createPrimaryKeyStrat,
              duplicateTaskReg,
              messaging
            )
          }
          // Nothing to run
          return { value: null }
        })
  )
    // Make sure we return void
    .then(() => { })
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
  createPrimaryKeyStrat: CreatePrimaryKeyStrategy,
  retryReg: RetryTaskStrategyRegistry,
  taskCreationReg: TaskCreationStrategyRegistry,
  duplicateTaskReg: DuplicateTaskStrategyRegistry,
  messaging: MessagingEventEmitter
): Promise<void> {
  if (isJobExecutionStateRunning(result)) {
    throw new TernError(`invalid job execution state ${JSON.stringify(result)}`)
  }
  return store
    .getTaskByExecutionJobId(execJobId)
    .then((task) => {
      if (!task) {
        throw new TaskNotFoundError(execJobId)
      }
      // It's possible to have the job execution frmaework send a finish
      // result before it returns to the launcher.  That should cause this
      // run-in-lease to wait until the lease that's owning the task launch
      // completes.

      // If the job execution framework returned immedately with the status,
      // then on completion emits a signal that the job completed, then this
      // will report an error about invalid state because the job framework
      // was written incorrectly.

      return runUpdateInLease(store, SCHEDULE_STATE_END_TASK, task.schedule, task.pk, now, lease, messaging,
        (sched): Promise<LeaseExitStateValue<null>> => {
          if (isJobExecutionStateFailed(result)) {
            return store
              .markTaskFailed(task, now, TASK_STATE_STARTED, TASK_STATE_COMPLETE_ERROR, result.result || '')
              .then(() =>
                retryTask(
                  store,
                  now,
                  sched,
                  task,
                  result.result || '',
                  createPrimaryKeyStrat,
                  retryReg,
                  taskCreationReg,
                  duplicateTaskReg,
                  messaging
                ))
          } else if (isJobExecutionStateCompleted(result)) {
            return store
              .markTaskCompleted(task, now, result.result || '')
              .then(() => {
                messaging.emit('taskFinished', task)
                return { value: null }
              })
          } else {
            return Promise.reject(new InvalidJobExecutionStatusError(result))
          }
        })
    })
    // make sure we return void
    .then(() => { })
}


/**
 * Get the lease and disable the scheduled job.
 *
 * @param store
 * @param schedule
 * @param now
 * @param leaseBehavior
 * @param messaging
 */
export function disableSchedule(
  store: DataStore,
  schedule: ScheduledJobModel,
  reason: string | null,
  now: Date,
  leaseBehavior: LeaseBehavior,
  messaging: MessagingEventEmitter
): Promise<void> {
  return runUpdateInLease(store, SCHEDULE_STATE_PASTURE, schedule.pk, null, now, leaseBehavior, messaging,
    (): LeaseExitStateValue<null> => {
      return { value: null, pasture: true, pastureReason: reason || undefined }
    })
    // Ensure we return void
    .then(() => { })
}


function retryTask(
  store: DataStore,
  now: Date,
  sched: ScheduledJobModel,
  task: TaskModel,
  failureReason: string,
  createPrimaryKeyStrat: CreatePrimaryKeyStrategy,
  retryReg: RetryTaskStrategyRegistry,
  taskCreationReg: TaskCreationStrategyRegistry,
  duplicateTaskReg: DuplicateTaskStrategyRegistry,
  messaging: MessagingEventEmitter
): Promise<LeaseExitStateValue<null>> {
  // Handle retry
  const retryInSeconds = retryReg.get(sched.retryStrategy)(sched, task, failureReason)
  if (retryInSeconds === null) {
    // No retry.  May need to queue up another task.
    const taskCreationStrategy = taskCreationReg.get(sched.taskCreationStrategy)
    if (isTaskCreationStrategyAfterFinish(taskCreationStrategy)) {
      const taskRunDate = taskCreationStrategy.createAfterTaskFinishes(now, sched)
      if (isTaskCreationDisable(taskRunDate)) {
        return Promise.resolve({ value: null, pasture: true })
      }
      const newTask: TaskModel = {
        pk: createPrimaryKeyStrat(),
        schedule: sched.pk,
        createdOn: now,
        state: TASK_STATE_PENDING,
        executeAt: taskRunDate.runAt,
        executionJobId: null,
        retryIndex: 0,
        completedInfo: null,
        executionQueued: null,
        executionStarted: null,
        executionFinished: null,
        nextTimeoutCheck: null,
      }
      return store.addTask(newTask)
        .then(() => {
          // A new task was created, and the old task completed.
          messaging.emit('taskCreated', newTask)
          messaging.emit('taskFinished', task)
          return { value: null }
        })
    }
    // Nothing to run after task finished, but the task did finish.
    messaging.emit('taskFinished', task)
    return Promise.resolve({ value: null })
  }
  // Queue a retry task
  // Retry time is based on when the task was discovered to be failed,
  // which is the "now" time.
  // Note that we're keeping the date in UTC.
  const retryTime = cloneDateTime(now)
  retryTime.setSeconds(retryTime.getSeconds() + retryInSeconds)
  return addTaskDuplicateCheck(
    store,
    now,
    sched,
    task,
    retryTime,
    createPrimaryKeyStrat,
    duplicateTaskReg,
    messaging
  )
}


function addTaskDuplicateCheck(
  store: DataStore,
  now: Date,
  sched: ScheduledJobModel,
  task: TaskModel,
  executeAt: Date,
  createPrimaryKeyStrat: CreatePrimaryKeyStrategy,
  duplicateTaskReg: DuplicateTaskStrategyRegistry,
  messaging: MessagingEventEmitter
): Promise<LeaseExitStateValue<null>> {
  // Check if there's another task already in queued or running state
  // for this schedule.  If so, run duplicate strategy logic.
  return store
    .getActiveTasksForScheduledJob(sched, DUPLICATE_RUNNING_TASK_LIMIT)
    .then((activeTasks) => {
      if (activeTasks.length > 0) {
        const strat = duplicateTaskReg.get(sched.duplicateStrategy)(sched, activeTasks, task)
        if (strat === DUPLICATE_TASK_SKIP_NEW) {
          logInfo('taskFinished', `Skipping creating new task on retry for schedule ${sched.pk}`)
          // In this case, retry is not triggered.  So, we complete the task.
          messaging.emit('taskFinished', task)
          return Promise.resolve({ value: null })
        }
        // else the duplicate running tasks don't inhibit retrying.
      }
      // else, no active tasks, so no conflict.
      const newTask: TaskModel = {
        pk: createPrimaryKeyStrat(),
        schedule: sched.pk,
        createdOn: now,
        state: TASK_STATE_PENDING,
        executeAt,
        executionJobId: null,
        retryIndex: 0,
        completedInfo: null,
        executionQueued: null,
        executionStarted: null,
        executionFinished: null,
        nextTimeoutCheck: null,
      }
      return store.addTask(newTask)
        .then(() => {
          // A new task was created, and the old task completed.
          messaging.emit('taskCreated', newTask)
          messaging.emit('taskFinished', task)
          return { value: null }
        })
    })
}

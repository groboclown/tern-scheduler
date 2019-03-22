
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
import {
  TaskNotFoundError,
  InvalidJobExecutionStatusError,
  LeaseNotObtainedError,
  InvalidTaskStateError,
} from '../errors/controller-errors'
import { RetryTaskStrategyRegistry } from '../strategies/retry'
import {
  isTaskCreationStrategyAfterStart,
  isTaskCreationDisable,
  isTaskCreationStrategyAfterFinish
} from '../strategies/task-creation/api'
import {
  SCHEDULE_STATE_START_TASK,
  SCHEDULE_STATE_END_TASK,
  SCHEDULE_STATE_PASTURE
} from '../model/schedule'
import { cloneDateTime } from '../internal/time-util'


const DUPLICATE_PENDING_TASK_LIMIT = 15

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
      // FIXME use duplicate strategy to see if there are other RUNNING state tasks,
      // and pass that to the duplicate job checker.
      store
        .markTaskQueued(task, now)
        .then(() => shouldSkipTask(store, sched, task, duplicateTaskReg))
        .then((shouldSkip): Promise<JobExecutionState | null> => {
          if (shouldSkip) {
            logInfo('startTask', `skipping ${task.pk} due to other running tasks`)
            return Promise.resolve(null)
          }

          // The only external system we're allowed to call while we have a
          // scheduled job lease.
          return startJob(task.pk, sched.jobName, sched.jobContext)
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
        })
        .then((execStatus): Promise<LeaseExitStateValue<TaskModel | null>> => {
          if (!execStatus) {
            // Skipped
            return store
              .markTaskSkipped(task, currentTimeUTC())
              .then(() => ({ value: task }))
          }
          if (isJobExecutionStateCompleted(execStatus)) {
            // Do not emit events, because it was entirely self-contained.
            return store
              .markTaskStarted(task, currentTimeUTC(), execStatus.jobId)
              .then(() =>
                store.markTaskCompleted(task, currentTimeUTC(), execStatus.result || ''))
              .then(() => ({ value: task }))
          }
          if (isJobExecutionStateDidNotStart(execStatus)) {
            // Do not emit events, because it was entirely self-contained.
            // Do not retry the failure, because this disables the job.
            return store.markTaskStartFailed(task, currentTimeUTC(), execStatus.result || '')
              .then(() => ({ value: null, pasture: true }))
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
          }
          if (isJobExecutionStateRunning(execStatus)) {
            return store
              .markTaskStarted(task, currentTimeUTC(), execStatus.jobId)
              .then(() => {
                messaging.emit('taskRunning', task, execStatus.jobId)
              })
              .then(() => ({ value: task }))
          }
          return Promise.reject(new InvalidJobExecutionStatusError(execStatus))
        })
        .then((currentTask: LeaseExitStateValue<TaskModel | null>): Promise<any> => {
          if (currentTask.pasture || currentTask.value === null) {
            // Don't allocate a new task.
            return Promise.resolve()
          }
          // Check the job if a new task should be created.
          const taskCreationStrategy = taskCreationReg.get(sched.taskCreationStrategy)
          if (isTaskCreationStrategyAfterStart(taskCreationStrategy)) {
            const taskRunDate = taskCreationStrategy.createAfterTaskStarts(now, sched)
            if (isTaskCreationDisable(taskRunDate)) {
              return Promise.resolve({ value: null, pasture: true })
            }
            logInfo('startTask', 'adding follow-up task with duplicate check')
            return addTaskDuplicateCheck(
              store,
              now,
              sched,
              currentTask.value,
              taskRunDate.runAt,
              createPrimaryKeyStrat,
              duplicateTaskReg,
              messaging
            )
          }
          // Nothing to run
          return Promise.resolve()
        })
        .then(() => {
          return { value: null }
        })
  )
    .catch((e) => {
      if (e instanceof LeaseNotObtainedError) {
        // This operation attempts to begin the execution of a task.  If a
        // lease could not be obtained, then the state of the needs-to-execute
        // of the task has not changed.  Therefore, it is safe to not
        // propigate this error.
        messaging.emit('taskStartNoLease', task, e.leaseOwner)
        return Promise.resolve()
      }
      return Promise.reject(e)
    })
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
        (sched): Promise<LeaseExitStateValue<any>> => {
          // We have the lock, but there is also a possibility that the
          // task has already been marked as completed by another service
          // (for example, if they are listening to a shared message queue).
          // In that situation, the markTask(state) can cause a failure
          // because the task is not in the exected started state.
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
                const taskCreationStrategy = taskCreationReg.get(sched.taskCreationStrategy)
                if (isTaskCreationStrategyAfterFinish(taskCreationStrategy)) {
                  const taskRunDate = taskCreationStrategy.createAfterTaskFinishes(now, sched)
                  if (isTaskCreationDisable(taskRunDate)) {
                    return Promise.resolve({ value: null, pasture: true })
                  }
                  logInfo('taskFinished', 'adding follow-up task with duplicate check')
                  return addTaskDuplicateCheck(
                    store,
                    now,
                    sched,
                    task,
                    taskRunDate.runAt,
                    createPrimaryKeyStrat,
                    duplicateTaskReg,
                    messaging
                  ).then(() => ({ value: null }))
                }
                return Promise.resolve({ value: null })
              })
          } else {
            return Promise.reject(new InvalidJobExecutionStatusError(result))
          }
        })
        .catch((e) => {
          // This function is called by a service that receives the "task
          // completed" message from the job execution framework.  This is not
          // guaranteed to be recoverable by other services.  If the lease is not
          // obtained, then we should propagate this error to inform the user
          // that the execution finished state may not have been correctly updated.

          // TODO convert the error to an update-not-performed kind of error, with
          // necessary information.
          if (e instanceof LeaseNotObtainedError) {
            // Do not propagate this error.
            messaging.emit('taskFinishedNoLease', task, e.leaseOwner, result)
            return Promise.resolve()
          }

          if (e instanceof InvalidTaskStateError) {
            // This means that the task was already updated by another service
            // before this one obtained the lock.
            messaging.emit('taskFinishedNotUpdated', task, e.newState, result)
            return Promise.resolve()
          }

          return Promise.reject(e)
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
): Promise<LeaseExitStateValue<TaskModel | null>> {
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
    // Nothing to run after task finished, but the task did finish.
    messaging.emit('taskFinished', task)
    return Promise.resolve({ value: task })
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
): Promise<LeaseExitStateValue<TaskModel>> {
  // Unlike execution, there should be at most one queued task per scheduled job.
  // This is not part of duplicate strategy.
  return store
    // Do not add a task if there's already a pending task.
    .getTasksForScheduledJob(sched, [TASK_STATE_PENDING], DUPLICATE_PENDING_TASK_LIMIT)
    .then((queuedTasks) => {
      if (queuedTasks.length > 0) {
        logInfo(
          'taskFinished', `*** Skipping creating new task for schedule ${sched.pk}; `
          + `${queuedTasks.length} queued task(s) (previous task ${task.pk})`
          // FIXME DEBUG
          + JSON.stringify(queuedTasks)
        )
        // In this case, retry is not triggered.  So, we complete the task.
        messaging.emit('taskFinished', task)
        return Promise.resolve({ value: task })
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
          return { value: newTask }
        })
    })
}


function shouldSkipTask(
  store: DataStore,
  sched: ScheduledJobModel,
  taskToRun: TaskModel,
  dupSchedReg: DuplicateTaskStrategyRegistry
): Promise<boolean> {
  const dup = dupSchedReg.get(sched.duplicateStrategy)
  return store
    .getTasksForScheduledJob(sched, [TASK_STATE_STARTED], dup.duplicateFindCount)
    .then((runningTasks) => {
      return dup.shouldSkip(sched, runningTasks, taskToRun)
    })
}

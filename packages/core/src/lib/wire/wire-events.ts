
import {
  DataStore
} from '../datastore'
import {
  startTask,
  taskFinished,
  repairExpiredSchedule,
  LeaseBehavior,
} from '../controller'
import {
  MessagingEventEmitter
} from '../messaging'
import {
  JobExecutionManager,
} from '../executor'
import {
  RetryTaskStrategyRegistry,
  DuplicateTaskStrategyRegistry,
  TaskCreationStrategyRegistry,
  CreatePrimaryKeyStrategy,
  CurrentTimeUTCStrategy,
} from '../strategies'
import {
  logCriticalError,
  logNotificationError,
  logInfo,
} from '../logging'
import { LeaseNotObtainedError } from '../errors'



/**
 * Wires up events between the data store and the event monitor and the job executor.
 *
 * Events that require polling are handled elsewhere.
 */
export function wireDataStore(
  store: DataStore,
  messaging: MessagingEventEmitter,
  leaseBehavior: LeaseBehavior,
  jobExecutor: JobExecutionManager,
  retryReg: RetryTaskStrategyRegistry,
  duplicateReg: DuplicateTaskStrategyRegistry,
  taskCreationReg: TaskCreationStrategyRegistry,
  createPrimaryKeyStrat: CreatePrimaryKeyStrategy,
  currentTimeUTC: CurrentTimeUTCStrategy
): void {
  jobExecutor.withMessaging(messaging)
  messaging
    .on('generalError', (e) => {
      // Standard log handling.  End users can monitor this in their own way.
      if (e instanceof LeaseNotObtainedError) {
        logNotificationError('(failed to obtain lease)', e.message)
      } else {
        logCriticalError(e)
      }
    })
    .on('internalError', (e) => {
      logCriticalError('Internal error discovered:')
      logCriticalError(e)
    })
    .on('scheduledJobLeaseExpired', (schedule) => {
      repairExpiredSchedule(store, schedule, currentTimeUTC(), leaseBehavior, messaging)
        .then(() => {
          logInfo('scheduledJobLeaseExpired', `Repaired schedule "${schedule.displayName}"`)
        })
        .catch((e) => {
          messaging.emit('generalError', e)
        })
    })
    .on('taskReadyToExecute', (task) => {
      const now = currentTimeUTC()
      startTask(
        store, task, leaseBehavior, now,
        jobExecutor.startJob, retryReg, taskCreationReg,
        duplicateReg, currentTimeUTC,
        createPrimaryKeyStrat, messaging
      )
        .catch((e) => {
          messaging.emit('generalError', e)
        })
    })
    .on('taskExecutingLong', (task) => {
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      logNotificationError(`task execution took too long: ${task.pk}`, null)
    })
    .on('taskQueuedLong', (task) => {
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      // FIXME inspect the task for repair
      logNotificationError(`task queue took too long: ${task.pk}`, null)
    })
    .on('jobExecutionFinished', (execId, result) => {
      const now = currentTimeUTC()
      taskFinished(
        store, execId, result, now, leaseBehavior, createPrimaryKeyStrat, retryReg, taskCreationReg, duplicateReg, messaging
      )
        .catch((e) => {
          messaging.emit('generalError', e)
        })
    })
}

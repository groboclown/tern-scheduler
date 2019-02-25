
import {
  DataStore
} from '../datastore'
import {
  startTask,
  taskFinished,
  LeaseBehavior,
  createTaskForSchedule,
} from '../controller'
import {
  MessagingEventEmitter
} from '../messaging'
import {
  currentTimeUTC
} from './time-util'
import {
  JobExecutionManager,
} from '../executor'
import {
  RetryTaskStrategyRegistry,
  DuplicateTaskStrategyRegistry,
  TaskCreationStrategyRegistry,
  CreatePrimaryKeyStrategy,
} from '../strategies'
import {
  logCriticalError, logNotificationError
} from '../logging'



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
): void {
  jobExecutor.withMessaging(messaging)
  messaging
    .on('generalError', e => {
      // Standard log handling.  End users can monitor this in their own way.
      logCriticalError(e)
    })
    .on('scheduledJobEnabled', schedule => {
      // Perform a task start check.  May be done by polling or other places,
      // but the create task check will need to be run due to this event.
      const now = currentTimeUTC()
      if (schedule.lastTaskExecutionDate && schedule.lastTaskExecutionDate < now) {
        messaging.emit('scheduledJobTaskCheck', schedule)
      }
    })
    .on('scheduledJobLeaseExpired', schedule => {
      // FIXME need to handle fixing expired job leases.
      logNotificationError(`scheduled job expired: ${schedule.pk}`, null)
    })
    .on('scheduledJobTaskCheck', schedule => {
      const now = currentTimeUTC()
      const execAt = taskCreationReg.get(schedule.taskCreationStrategy).createOnPoll(now, schedule)
      if (execAt !== null) {
        createTaskForSchedule(store, schedule, now, leaseBehavior, execAt, createPrimaryKeyStrat, 0, duplicateReg, messaging)
          .catch(e => {
            messaging.emit('generalError', e)
          })
      }
    })
    .on('taskReadyToExecute', task => {
      const now = currentTimeUTC()
      startTask(store, task, leaseBehavior, now, jobExecutor.startJob)
        .catch(e => {
          messaging.emit('generalError', e)
        })
    })
    .on('jobExecutionFinished', (execId, result) => {
      const now = currentTimeUTC()
      taskFinished(store, execId, result, now, leaseBehavior, retryReg, duplicateReg, messaging)
    })
}

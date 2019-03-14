import {
  ScheduledJobModel,
  SCHEDULE_STATE_ADD_TASK,
  SCHEDULE_STATE_START_TASK,
  SCHEDULE_STATE_END_TASK,
  SCHEDULE_STATE_PASTURE,
  LeaseIdType,
} from '../model'
import {
  DataStore
} from '../datastore'
import {
  LeaseBehavior,
} from './schedule'
import {
  MessagingEventEmitter,
} from '../messaging'


/**
 * Performs repair operations on locked schedules.
 */
export function repairExpiredSchedule(
  store: DataStore,
  srcSchedule: ScheduledJobModel,
  now: Date,
  leaseBehavior: LeaseBehavior,
  messaging: MessagingEventEmitter
): Promise<void> {
  // First, obtain a repair lock.
  const leaseId = leaseBehavior.leaseOwnerStrategy()
  return store
    .repairExpiredLeaseForScheduledJob(
      srcSchedule.pk,
      leaseId,
      now,
      leaseBehavior.leaseTimeSeconds
    )
    .then((schedule) => {
      if (!schedule) {
        return Promise.resolve()
      }
      return performRepair(store, schedule, leaseId, now, messaging)
        .then((exitBehavior: ExitBehavior | null) => {
          if (exitBehavior) {
            return store.releaseScheduledJobLease(
              leaseId,
              srcSchedule.pk,
              exitBehavior.pastureReason !== undefined,
              exitBehavior.pastureReason || null
            )
          }
          return Promise.resolve()
        })
        .catch((e) => {
          return store.releaseScheduledJobLease(
            leaseId,
            srcSchedule.pk,
            true, String(e)
          )
            .then(() => {
              messaging.emit('generalError', e)
            })
        })
    })
}
interface ExitBehavior {
  pastureReason?: string
}


function performRepair(
  store: DataStore,
  schedule: ScheduledJobModel,
  leaseId: LeaseIdType,
  now: Date,
  messaging: MessagingEventEmitter
): Promise<ExitBehavior> {
  // The before repair state determines what should be done.
  switch (schedule.repairState) {
    case SCHEDULE_STATE_ADD_TASK: {
      return repairAddTask(store, schedule, leaseId, now, messaging)
    }
    case SCHEDULE_STATE_START_TASK: {
      return repairStartTask(store, schedule, leaseId, now, messaging)
    }
    case SCHEDULE_STATE_END_TASK: {
      return repairEndTask(store, schedule, leaseId, now, messaging)
    }
    case SCHEDULE_STATE_PASTURE: {
      return repairPasture(store, schedule, leaseId, now, messaging)
    }
    default: {
      // For "null" value:
      // The schedule had an expired lease, but the original updateState was null.
      // Could also mean a bug in the datastore where the repairState wasn't set to the
      // previous state.
      // In either case, it indicates an internal bug in the scheduler.

      // For "repair" value:
      // This indicates a bug in the datastore, where it incorrectly copied the update
      // state into the repair state.

      messaging.emit('internalError', {
        message: `Internal Error: Schedule ${schedule.pk} state [${schedule.repairState}] unknown`,
      })
      return Promise.resolve({ pastureReason: 'Invalid internal state discovered during repair' })
    }
  }
}


function repairAddTask(
  store: DataStore,
  schedule: ScheduledJobModel,
  leaseId: LeaseIdType,
  now: Date,
  messaging: MessagingEventEmitter
): Promise<ExitBehavior> {
  return Promise.reject('not implemented')
}


function repairStartTask(
  store: DataStore,
  schedule: ScheduledJobModel,
  leaseId: LeaseIdType,
  now: Date,
  messaging: MessagingEventEmitter
): Promise<ExitBehavior> {
  return Promise.reject('not implemented')
}


function repairEndTask(
  store: DataStore,
  schedule: ScheduledJobModel,
  leaseId: LeaseIdType,
  now: Date,
  messaging: MessagingEventEmitter
): Promise<ExitBehavior> {
  return Promise.reject('not implemented')
}


function repairPasture(
  store: DataStore,
  schedule: ScheduledJobModel,
  leaseId: LeaseIdType,
  now: Date,
  messaging: MessagingEventEmitter
): Promise<ExitBehavior> {
  return Promise.reject('not implemented')
}

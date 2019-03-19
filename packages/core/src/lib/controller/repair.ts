import {
  ScheduledJobModel,
  SCHEDULE_STATE_ADD_TASK,
  SCHEDULE_STATE_START_TASK,
  SCHEDULE_STATE_END_TASK,
  SCHEDULE_STATE_PASTURE,
  LeaseIdType,
  TaskModel,
  TASK_STATE_QUEUED,
  TASK_STATE_STARTED,
  TASK_STATE_COMPLETE_QUEUED,
  TASK_STATE_PENDING,
} from '../model'
import {
  DataStore,
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

      // For any other value:
      // Either an external entity set the state to an unexpected value, or the list
      // of states expanded without updating this repair block, or there was a bug
      // in the code.

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
  // This state only happens when the schedule is first created.
  // No task has run yet.
  if (schedule.pasture) {
    return Promise.resolve({ pastureReason: schedule.pastureReason || '<invalid state>' })
  }

  const taskPk = schedule.updateTaskPk
  if (taskPk) {
    // The task was added, but the lock wasn't properly released.
    // Probably shouldn't happen, but some store implementations might
    // be able to get into this state.
    // Double check that the task was actually created.
    return getPendingTasksForSchedule(store, schedule)
      .then((tasks) => {
        if (tasks.length > 0) {
          // It was created.  Just need to close off the lease.
          // There's nothing more to do here.
          return Promise.resolve({})
        } else {
          // It wasn't created.  Or, it was created, but it's in an active
          // state.
          // FIXME create the task.  Reuse logic from the `combined.ts` file.
          return Promise.reject(`task ${taskPk} recorded: repair not implemented`)
        }
      })
  } else {
    // The scheduled job didn't record in itself the task, or the task
    // wasn't created.
    return getPendingOrActiveTasksForSchedule(store, schedule)
      .then((tasks) => {
        if (tasks.length > 0) {

        } else {

        }
        // FIXME create the task.  Reuse logic from the `combined.ts` file.
        return Promise.reject(`task ${taskPk} recorded: repair not implemented`)
      })
  }
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

const TASK_FETCH_LIMIT = 100

/*
function getActiveTasksForSchedule(store: DataStore, schedule: ScheduledJobModel): Promise<TaskModel[]> {
  return store.getTasksForScheduledJob(schedule, [
    TASK_STATE_QUEUED, TASK_STATE_STARTED, TASK_STATE_COMPLETE_QUEUED
  ], TASK_FETCH_LIMIT)
}
*/

function getPendingTasksForSchedule(store: DataStore, schedule: ScheduledJobModel): Promise<TaskModel[]> {
  return store.getTasksForScheduledJob(schedule, [
    TASK_STATE_PENDING,
  ], TASK_FETCH_LIMIT)
}

function getPendingOrActiveTasksForSchedule(store: DataStore, schedule: ScheduledJobModel): Promise<TaskModel[]> {
  return store.getTasksForScheduledJob(schedule, [
    TASK_STATE_QUEUED, TASK_STATE_STARTED, TASK_STATE_COMPLETE_QUEUED,
    TASK_STATE_PENDING,
  ], TASK_FETCH_LIMIT)
}

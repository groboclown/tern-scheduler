
/**
 * Augments to the DataStore behavior...
 */


import {
  PrimaryKeyType,
  LeaseIdType,
  ScheduledJobModel,
} from '../model'
import {
  DataStore,
} from '../datastore'
import {
  PollWaitTimes,
} from '../strategies/poll'
import {
  ScheduledJobNotFoundError, TernError,
} from '../errors'
import {
  logNotificationError,
  logDebug,
} from '../logging'
import {
  CreateLeaseIdStrategy,
  CreatePrimaryKeyStrategy,
  RegisterPollCallback,
} from '../strategies'
import {
  SCHEDULE_STATE_UPDATING, SCHEDULE_STATE_ACTIVE, SCHEDULE_STATE_DISABLED, SCHEDULE_STATE_REPAIR,
} from '../model/schedule'
import { MessagingEventEmitter } from '../messaging';


/**
 * An expicit subset of the ScheduledJobModel used to create the job entry.
 * All the other values are set automatically.
 */
export interface NewScheduledJob {
  readonly displayName: string
  readonly description: string
  readonly duplicateStrategy: string
  readonly jobName: string
  readonly jobContext: string
  readonly retryStrategy: string
  readonly taskCreationStrategy: string
  readonly scheduleDefinition: string
}


export interface LeaseBehavior {
  leaseOwnerStrategy: CreateLeaseIdStrategy

  /** How long leases should be held for */
  leaseTimeSeconds: number

  /**
   * Strategy for retrying to obtain the lease.
   * The retry logic will retry once per item in the
   * list, and wait for that long before the retry.
   * If the list contains 0 elements, then there is no
   * retry made.
   */
  retrySecondsDelay: PollWaitTimes

  /**
   * Have the `callback` be called after the `delaySeconds` have passed.
   *
   * Allows for configurable behavior, including mocking out the time calls.
   */
  registerRetryCallback: RegisterPollCallback
}


export interface LeaseExitStateValue<T> {
  value: T
  state?: SCHEDULE_STATE_ACTIVE | SCHEDULE_STATE_DISABLED
}


export interface LeaseExitStateError {
  error: any
  state?: SCHEDULE_STATE_REPAIR | SCHEDULE_STATE_DISABLED
}

export type LeaseExitState<T> = LeaseExitStateValue<T> | LeaseExitStateError

function isLeaseExitStateValue<T>(v: LeaseExitState<T>): v is LeaseExitStateValue<T> {
  return !!(<any>v).value
}

function isLeaseExitStateError<T>(v: LeaseExitState<T>): v is LeaseExitStateError {
  return !!(<any>v).error
}


/**
 * Creates the scheduled job in a leased state, then runs the `withLease` action,
 * then releases the lease.  Any generated error will put the scheduled job
 * into a needs-repair state.
 *
 * All errors in the returned promise have not been reported to the messaging
 * events.  Only internal errors that would otherwise mask the more important
 * errors are reported to the messaging events.
 *
 * For internal use of the controller; end-users should use the
 * `combined` method instead.
 */
export function createScheduledJobAlone<T>(
  store: DataStore,
  scheduledJob: NewScheduledJob,
  now: Date,
  leaseBehavior: LeaseBehavior,
  pkStrategy: CreatePrimaryKeyStrategy,
  messaging: MessagingEventEmitter,
  withLease: (scheduledJob: ScheduledJobModel) => Promise<LeaseExitState<T>> | LeaseExitState<T>
): Promise<T> {
  const leaseOwner = leaseBehavior.leaseOwnerStrategy()
  const sched: ScheduledJobModel = {
    ...scheduledJob,
    state: SCHEDULE_STATE_UPDATING,
    createdOn: now,
    pk: pkStrategy()
  }
  logDebug('createScheduledJob', `starting addScheduledJobModel`)

  return store
    .addScheduledJobModel(sched, leaseOwner, now, leaseBehavior.leaseTimeSeconds)

    // FIXME DEBUG
    .catch(e => { logDebug(`caught addSchJob error`, e); throw e })

    // With the lease, perform the update behavior.
    .then(() => {
      logDebug('createScheduledJob', `after addScheduledJobModel succeeded`)
      // If the with-lease execution fails, then mark the update lease failure.
      // That means we need special handling just in here...
      let t: Promise<LeaseExitState<T>> | LeaseExitState<T>
      try {
        t = withLease(sched)
      } catch (e) {
        // The job must enter a needs-repair state.
        t = {
          error: e,
          state: SCHEDULE_STATE_DISABLED
        }
      }
      if (t instanceof Promise) {
        return t
          // Catch the promise errors first, because the "then" condition
          // can raise its own separate error.
          .catch(e => (<LeaseExitStateError>{ error: e, state: SCHEDULE_STATE_REPAIR }))
      } else {
        // It's fine.  Right?
        return Promise.resolve(t)
      }
    })
    .catch(e => {
      // Some problem was thrown while performing the other logic in the above
      // block.  This is a critical internal error.
      return store
        .markLeasedScheduledJobNeedsRepair(sched.pk, now)
        .catch(e2 => {
          // Lease release failed.  It's not as important as the inner error,
          // so report it and rethrow the inner error.
          messaging.emit('generalError', e2)
          throw e
        })
        .then(() => Promise.reject(e))
    })
    // With successful update behavior, release the lease and return the result.
    .then(result => {
      const endState = result.state || SCHEDULE_STATE_ACTIVE
      return (
        endState === SCHEDULE_STATE_REPAIR
          ? store.markLeasedScheduledJobNeedsRepair(sched.pk, now)
          : store.releaseScheduledJobLease(leaseOwner, sched.pk, endState)
      )
        .catch(e => {
          // The lease release failed.  This error isn't as important as
          // the underlying original error...
          if (isLeaseExitStateError(result)) {
            messaging.emit('generalError', e)
            throw result.error
          }
          // No "more important" error, so report this one.
          throw e
        })
        .then(() => {
          if (isLeaseExitStateError(result)) {
            throw result.error
          }
          return result.value
        })
    })
}


/**
 * Runs an operation inside a lease.  This captures the lease, and, only if the lease
 * capture is successful, it runs the lease then releases the lease.
 *
 * Only errors that, if thrown, would mask inner errors are reported to the events.
 * All other errors are just rejected in the promise.
 *
 * NOTE this does not steal the lease.
 *
 * @param store
 * @param jobPk
 * @param now
 * @param leaseBehavior
 * @param withLease
 */
export function runUpdateInLease<T>(
  store: DataStore,
  jobPk: PrimaryKeyType,
  now: Date,
  leaseBehavior: LeaseBehavior,
  messaging: MessagingEventEmitter,
  withLease: (scheduledJob: ScheduledJobModel, leaseId: LeaseIdType) => Promise<LeaseExitState<T>> | LeaseExitState<T>
): Promise<T> {
  const leaser = leaseBehavior.leaseOwnerStrategy()
  // Retry logic with a promise is weird...
  function rejectDelay<T>(timeout: number): (reason: any) => Promise<T> {
    return (reason: any): Promise<T> => new Promise<T>((_, reject) => {
      logNotificationError(`attempting to retry the operation in ${timeout} seconds`, reason)
      leaseBehavior.registerRetryCallback(timeout, () => reject(reason))
    })
  }
  let leaseAttemptPromise = store.leaseScheduledJob(jobPk, leaser, now, leaseBehavior.leaseTimeSeconds)
  for (let retrySeconds of leaseBehavior.retrySecondsDelay) {
    leaseAttemptPromise = leaseAttemptPromise
      .catch(rejectDelay<void>(retrySeconds))
      // The rejection will fire a reject when its time is up, and it was already reported.
      .catch(_ => store.leaseScheduledJob(jobPk, leaser, now, leaseBehavior.leaseTimeSeconds))
  }
  // leaseAttemptPromise is now setup such that if the last attempt failed, it will
  // be in the catch() block, and if it passed, then the then() block has the result.
  return leaseAttemptPromise
    .then(() => store.getJob(jobPk))
    .then(sched => {
      logDebug('createScheduledJob', `after addScheduledJobModel succeeded`)
      if (!sched) {
        throw new ScheduledJobNotFoundError(jobPk)
      }
      // If the with-lease execution fails, then mark the update lease failure.
      // That means we need special handling just in here...
      let t: Promise<LeaseExitState<T>> | LeaseExitState<T>
      try {
        t = withLease(sched, leaser)
      } catch (e) {
        // The scheduled job must enter a needs-repair state.
        t = {
          error: e,
          state: SCHEDULE_STATE_DISABLED
        }
      }
      if (!(t instanceof Promise)) {
        t = Promise.resolve(t)
      }
      return t
        // Catch the promise errors first, because the "then" condition
        // can raise its own separate error.
        .catch(e => (<LeaseExitStateError>{ error: e, state: SCHEDULE_STATE_REPAIR }))

        // With successful update behavior, release the lease and return the result.
        .then(result => {
          const endState = result.state || SCHEDULE_STATE_ACTIVE
          return (
            endState === SCHEDULE_STATE_REPAIR
              ? store.markLeasedScheduledJobNeedsRepair(sched.pk, now)
              : store.releaseScheduledJobLease(leaser, sched.pk, endState)
          )
            .catch(e => {
              // The lease release failed.  This error isn't as important as
              // the underlying original error...
              if (isLeaseExitStateError(result)) {
                messaging.emit('generalError', e)
                throw result.error
              }
              // No "more important" error, so report this one.
              throw e
            })
            .then(() => {
              if (isLeaseExitStateError(result)) {
                throw result.error
              }
              return result.value
            })
        })
    })
}
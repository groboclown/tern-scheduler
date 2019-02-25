
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
  CreateLeaseOwnerStrategy,
  CreatePrimaryKeyStrategy,
  RegisterPollCallback,
} from '../strategies'
import {
  SCHEDULE_STATE_UPDATING, SCHEDULE_STATE_ACTIVE,
} from '../model/schedule'


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
  leaseOwnerStrategy: CreateLeaseOwnerStrategy

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


/**
 * For internal use of the controller; end-users should use the
 * `combined` method instead.
 */
export function createScheduledJob<T>(
  store: DataStore,
  scheduledJob: NewScheduledJob,
  now: Date,
  leaseBehavior: LeaseBehavior,
  pkStrategy: CreatePrimaryKeyStrategy,
  withLease: (scheduledJob: ScheduledJobModel) => Promise<T> | T
): Promise<T> {
  const leaseOwner = leaseBehavior.leaseOwnerStrategy()
  const job: ScheduledJobModel = {
    ...scheduledJob,
    state: SCHEDULE_STATE_UPDATING,
    createdOn: now,
    lastTaskExecutionDate: null,
    pk: pkStrategy()
  }
  logDebug('createScheduledJob', `starting addScheduledJobModel`)

  return store
    .addScheduledJobModel(job, leaseOwner, now, leaseBehavior.leaseTimeSeconds)

    // FIXME DEBUG
    .catch(e => { logDebug(`caught addSchJob error`, e); throw e })

    // With the lease, perform the update behavior.
    .then(() => {
      logDebug('createScheduledJob', `after addScheduledJobModel succeeded`)
      // If the with-lease execution fails, then mark the update lease failure.
      // That means we need special handling just in here...
      let t: Promise<T> | T
      try {
        t = withLease(job)
      } catch (e) {
        // Same as a catch...
        return updateInLeaseFailed(store, leaseOwner, job.pk)
          // If the updateInLeaseFailed call fails, that error isn't
          // important.
          .catch(e2 => {
            logNotificationError('updateInLeaseFailed caused problem after lease operation failed', e2)
            throw e
          })
          .then(() => { throw e })
      }
      if (t instanceof Promise) {
        // TODO need to re-examine this situation.  It may be a different
        // kind of state, or just released state.
        return t
          .catch(e =>
            // Ensure that we propigate the failure...
            updateInLeaseFailed(store, leaseOwner, job.pk)
              // If the updateInLeaseFailed call fails, that error isn't
              // important.
              .catch(e2 => {
                logNotificationError('updateInLeaseFailed caused problem after lease operation failed', e2)
                throw e
              })
              .then(() => { throw e })
          )
      } else {
        // Everything's fine
        return Promise.resolve(t)
      }
    })
    // With successful update behavior, release the lease and return the result.
    .then(result =>
      store.releaseScheduledJobLease(leaseOwner, job.pk, SCHEDULE_STATE_ACTIVE)
        // Success all the way through.
        .then(() => result)
      // Error releasing the lease is normally propigated up.
      // This will usually mean either a data store problem or
      // something else already stole the lease.
    )
}


/**
 * This currenty has no way to detect if it stole the lease.
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
  withLease: (scheduledJob: ScheduledJobModel, leaseId: LeaseIdType) => Promise<T> | T
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
    .then(job => {
      logDebug('createScheduledJob', `after addScheduledJobModel succeeded`)
      if (!job) {
        throw new ScheduledJobNotFoundError(jobPk)
      }
      // If the with-lease execution fails, then mark the update lease failure.
      // That means we need special handling just in here...
      let t: Promise<T> | T
      try {
        t = withLease(job, leaser)
      } catch (e) {
        // Same as a catch...
        return updateInLeaseFailed(store, leaser, jobPk)
          // If the updateInLeaseFailed call fails, that error isn't
          // important.
          .catch(e2 => {
            logNotificationError('updateInLeaseFailed caused problem after lease operation failed', e2)
            throw e
          })
          .then(() => { throw e })
      }
      if (t instanceof Promise) {
        // TODO need to re-examine this situation.  It may be a different
        // kind of state, or just released state.
        return t
          .catch(e => updateInLeaseFailed(store, leaser, jobPk)
            // If the updateInLeaseFailed call fails, that error isn't
            // important.
            .catch(e2 => {
              logNotificationError('updateInLeaseFailed caused problem after lease operation failed', e2)
              throw e
            })
            .then(() => { throw e })
          )
      } else {
        // Everything's fine
        return Promise.resolve(t)
      }
    })
    // With successful update behavior, release the lease and return the result.
    .then(result => store
      .releaseScheduledJobLease(leaser, jobPk, SCHEDULE_STATE_ACTIVE)
      // Success all the way through.
      .then(() => result)
      // Error releasing the lease is normally propigated up.
      // This will usually mean either a data store problem or
      // something else already stole the lease.
    )
}

function updateInLeaseFailed(store: DataStore, leaser: LeaseIdType, pk: PrimaryKeyType): Promise<void> {
  // Only set the state to failed if it's alreday in the desired state.
  return store
    .failureDuringScheduledJobLease(leaser, pk)
}

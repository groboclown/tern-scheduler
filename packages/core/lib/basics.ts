
import * as libExecutor from './executor'
import * as libStrats from './strategies'
import EventEmitter from 'events'
import {
  DataStore, Page
} from './datastore'
import {
  ScheduledJobModel, TaskModel, PrimaryKeyType
} from './model'
import {
  MessagingEventEmitter,
} from './messaging'
import {
  StandardTime
} from './strategies/time'
import {
  UUIDCreatePrimaryKeyStrategy
} from './strategies/primary-key/uuid'
import {
  UUIDCreateLeaseIdStrategy,
} from './strategies/lease-id'
import {
  wireDataStore,
  pollLongExecutingTasks,
  pollLongQueuedTasks,
  pollScheduledJobsForExpiredLeases,
  pollTaskReadyToExecute,
} from './wire'
import {
  registerAlwaysRunDuplicateTaskStrategy,
  registerAlwaysSkipDuplicateTaskStrategy
} from './strategies/duplicate-task'
import {
  LeaseBehavior,
  NewScheduledJob,
  createScheduledJob as createScheduledJobCore,
  disableSchedule as disableScheduleCore,
} from './controller'
import {
  currentTimeLocal
} from './internal/time-util'

const MILLISECONDS_PER_SECOND = 1000
const DEFAULT_LEASE_TIME_SECONDS = 300
const DEFAULT_WAIT_FOR_COMPLETION_SECONDS = 600
const POLL_FOR_COMPLETION_MILLIS = MILLISECONDS_PER_SECOND


/**
 * An example implementation of the `RegisterPollCallback`
 * that supports stopping behavior.
 */
export class PollingCallback {
  readonly registerPollCallback: libStrats.RegisterPollCallback

  private count = 0
  private readonly runningCallbacks: { [id: string]: (() => void) } = {}
  private isActive: boolean = true
  private messaging: MessagingEventEmitter | null | undefined = null

  constructor(messaging?: MessagingEventEmitter) {
    this.messaging = messaging
    this.registerPollCallback = (delaySeconds, callback) => {
      if (this.active) {
        const id = (this.count++).toString()
        this.runningCallbacks[id] = callback
        setTimeout(() => {
          if (this.active) {
            try {
              callback()
            } catch (e) {
              if (this.messaging) {
                this.messaging.emit('generalError', e)
              }
              // Else no messaging registered, so we aren't logging it.
            }
          }
          delete this.runningCallbacks[id]
        }, delaySeconds * MILLISECONDS_PER_SECOND)
      }
    }
  }

  setEventEmitter(ee: MessagingEventEmitter | null): void {
    this.messaging = ee
  }

  get active(): boolean {
    return this.isActive
  }

  activeCount(): number {
    return Object.keys(this.runningCallbacks).length
  }

  stop(): void {
    this.isActive = false
  }

  stopAndWait(timeoutSeconds?: number): Promise<void> {
    this.isActive = false
    const ts = timeoutSeconds === undefined ? DEFAULT_WAIT_FOR_COMPLETION_SECONDS : timeoutSeconds
    // We are okay to use local time here, because the end is measured relative to
    // the returned time.  We don't care that the date is in UTC or not.
    const timedOut = currentTimeLocal().valueOf() + (ts * MILLISECONDS_PER_SECOND)
    return new Promise((resolve, reject) => {
      const tryIt = () => {
        if (this.activeCount() > 0) {
          const now = currentTimeLocal().valueOf()
          if (now > timedOut) {
            reject(new Error('timed out waiting for stop'))
          } else {
            setTimeout(tryIt, POLL_FOR_COMPLETION_MILLIS)
          }
        } else {
          resolve()
        }
      }
      tryIt()
    })
  }
}


/**
 * Everything needed for interacting with the scheduler API.
 */
export class TernConfiguration {
  readonly store: DataStore
  readonly messaging: MessagingEventEmitter
  readonly leaseBehavior: LeaseBehavior
  readonly strategies: libStrats.AllStrategies


  constructor(args: {
    store: DataStore
    generatePollWaitTimesStrategy: libStrats.GeneratePollWaitTimesStrategy
    retryLeaseTimeStrategy: libStrats.CreateLeaseRetryTimeInSecondsStrategy

    // One of these two must be called
    registerPollCallback?: libStrats.RegisterPollCallback
    pollingCallback?: PollingCallback

    createPrimaryKeyStrategy?: libStrats.CreatePrimaryKeyStrategy
    createLeaseIdStrategy?: libStrats.CreateLeaseIdStrategy
    currentTimeUTCStrategy?: libStrats.CurrentTimeUTCStrategy
    leaseTimeSeconds?: number
    createLeaseTimeInSecondsStrategy?: libStrats.CreateLeaseTimeInSecondsStrategy
  }) {
    this.store = args.store
    this.messaging = new EventEmitter()

    const leaseTimeSeconds = args.leaseTimeSeconds

    this.strategies = {
      createPrimaryKeyStrategy: args.createPrimaryKeyStrategy || UUIDCreatePrimaryKeyStrategy,
      createLeaseIdStrategy: args.createLeaseIdStrategy || UUIDCreateLeaseIdStrategy,
      createLeaseTimeInSecondsStrategy:
        args.createLeaseTimeInSecondsStrategy
          ? args.createLeaseTimeInSecondsStrategy
          : typeof leaseTimeSeconds === 'number'
            ? () => leaseTimeSeconds
            : () => DEFAULT_LEASE_TIME_SECONDS,
      currentTimeUTCStrategy: args.currentTimeUTCStrategy || StandardTime,
      generatePollWaitTimesStrategy: args.generatePollWaitTimesStrategy,

      // Specific per context
      taskCreationStrategyRegistry: libStrats.createStrategyRegistry(),
      duplicateTaskStrategyRegistry: libStrats.createStrategyRegistry(),
      retryTaskStrategyRegistry: libStrats.createStrategyRegistry(),
    }
    registerAlwaysRunDuplicateTaskStrategy(this.strategies.duplicateTaskStrategyRegistry)
    registerAlwaysSkipDuplicateTaskStrategy(this.strategies.duplicateTaskStrategyRegistry)

    // TODO register standard task creation strategies.
    let pc: libStrats.RegisterPollCallback
    if (args.registerPollCallback) {
      pc = args.registerPollCallback
    } else if (args.pollingCallback) {
      pc = args.pollingCallback.registerPollCallback
      args.pollingCallback.setEventEmitter(this.messaging)
    } else {
      throw new Error(`Must provide registerPollCallback or pollingCallback`)
    }

    this.leaseBehavior = {
      leaseOwnerStrategy: this.strategies.createLeaseIdStrategy,
      leaseTimeSeconds: this.strategies.createLeaseTimeInSecondsStrategy(),
      retrySecondsDelay: args.retryLeaseTimeStrategy(),
      registerRetryCallback: pc,
    }
  }
}



export class TernClient {
  constructor(readonly configuration: TernConfiguration) { }


  /**
   * Adds a new scheduled job to the data store, and creates the
   * first pending task for that schedule.
   *
   * @param scheduledJob
   */
  createScheduledJob(scheduledJob: NewScheduledJob): Promise<PrimaryKeyType> {
    return createScheduledJobCore(
      this.configuration.store,
      scheduledJob,
      this.configuration.leaseBehavior,
      this.configuration.strategies.currentTimeUTCStrategy(),
      this.configuration.strategies.createPrimaryKeyStrategy,
      this.configuration.strategies.taskCreationStrategyRegistry,
      this.configuration.messaging)
  }

  /**
   * Disable an active scheduled job.
   *
   * @param configuration
   * @param scheduledJob
   */
  disableScheduledJob(scheduledJob: ScheduledJobModel): Promise<void> {
    return disableScheduleCore(
      this.configuration.store,
      scheduledJob,
      this.configuration.strategies.currentTimeUTCStrategy(),
      this.configuration.leaseBehavior,
      this.configuration.messaging
    )
  }

  // Note: Delete scheduled job not added here, because there are issues with it.

  /**
   * Returns scheduled jobs which are not disabled.  Intended for UI use.  The paging
   * key is null if asking for the first page, otherwise it should be the paging
   * key from the previous request.  The opaque key is used to accomodate potential
   * changes to the scheduled job list between calls, so that paging through the list
   * does not skip entries.
   *
   * @param pageKey opaque indicator for the starting page to read.
   * @param limit suggested maximum records returned
   */
  getActiveScheduledJobs(pageKey: string | null, limit: number
  ): Promise<Page<ScheduledJobModel>> {
    return this.configuration.store.getActiveScheduledJobs(pageKey, limit)
  }

  /**
   * Just like `#getActiveScheduledJobs`, but for disabled jobs.
   *
   * @param pageKey opaque indicator for the starting page to read.
   * @param limit suggested maximum records returned
   */
  getDisabledScheduledJobs(pageKey: string | null, limit: number): Promise<Page<ScheduledJobModel>> {
    return this.configuration.store.getDisabledScheduledJobs(pageKey, limit)
  }

  /**
   * Get a page of all the tasks recorded as currently executing.  This is done while
   * ignoring lease states.
   *
   * @param pageKey opaque indicator for the starting page to read.
   * @param limit suggested maximum records returned
   */
  getExecutingTasks(pageKey: string | null, limit: number): Promise<Page<TaskModel>> {
    return this.configuration.store.getExecutingTasks(pageKey, limit)
  }

  /**
   * Get a page of all the tasks recorded as waiting to execute.  This is done while
   * ignoring lease states.
   *
   * @param pageKey opaque indicator for the starting page to read.
   * @param limit suggested maximum records returned
   */
  getPendingTasks(pageKey: string | null, limit: number): Promise<Page<TaskModel>> {
    return this.configuration.store.getPendingTasks(pageKey, limit)
  }

  /**
   * Get a page of tasks which are in any of the "failed" states.
   *
   * @param since must be in UTC time
   */
  getFailedTasks(pageKey: string | null, limit: number, since?: Date): Promise<Page<TaskModel>> {
    return this.configuration.store.getFailedTasks(pageKey, limit, since)
  }

  /**
   * Get a page of tasks which the job execution framework has marked as completed without
   * failure.
   *
   * @param pageKey
   * @param limit
   * @param since must be in UTC time
   */
  getCompletedTasks(pageKey: string | null, limit: number, since?: Date): Promise<Page<TaskModel>> {
    return this.configuration.store.getCompletedTasks(pageKey, limit, since)
  }

  /**
   * Get a page of tasks which have finished execution, regardless of fail state.
   *
   * @param pageKey
   * @param limit
   * @param since must be in UTC time
   */
  getFinishedTasks(pageKey: string | null, limit: number, since?: Date): Promise<Page<TaskModel>> {
    return this.configuration.store.getFinishedTasks(pageKey, limit, since)
  }
}




/**
 * A public facing facade on top of all the fun stuff in the scheduler.
 */
export class TernScheduler {
  readonly config: TernConfiguration
  readonly strategies: libStrats.AllStrategies

  private readonly jobExecution: libExecutor.JobExecutionManager

  constructor(configuration: TernConfiguration, jobExecution: libExecutor.JobExecutionManager) {
    this.config = configuration
    this.jobExecution = jobExecution
    this.strategies = configuration.strategies

    this.jobExecution.withMessaging(this.config.messaging)
    wireDataStore(
      this.config.store,
      this.config.messaging,
      this.config.leaseBehavior,
      this.jobExecution,
      this.strategies.retryTaskStrategyRegistry,
      this.strategies.duplicateTaskStrategyRegistry,
      this.strategies.taskCreationStrategyRegistry,
      this.strategies.createPrimaryKeyStrategy,
      this.strategies.currentTimeUTCStrategy
    )
  }

  /**
   * Add polling for long executing tasks to the event emitter, for systems
   * where the job executor or message bus does not provide this behavior.
   *
   * Tasks which are considered "long executing" tells the system that they
   * have gone beyond the normal execution time, and probably have encountered
   * a partial failure, and need some corrective action.
   *
   * If the job execution framework provides this behavior, then it SHOULD NOT
   * be invoked.
   *
   * @param longTimeSeconds what should be considered a "long time" for the task to be executing.
   */
  pollLongExecutingTasks(longTimeSeconds: number): void {
    pollLongExecutingTasks(
      this.config.store,
      longTimeSeconds,
      this.strategies.generatePollWaitTimesStrategy,
      this.config.leaseBehavior.registerRetryCallback,
      this.config.messaging
    )
  }

  /**
   * Add polling for long queued tasks to the event emitter, for systems where
   * the message bus does not provide this behavior.
   *
   * Tasks which are considered "long queued" means that the time between when
   * a request to the job executor to start the job and when it returned has
   * gone beyond the normal time expected for this operation, and probably
   * means that the request has encountered a partial failure.  The task
   * may need some corrective action, such as make another request.
   *
   * @param longTimeSeconds what should be considered a "long time" for the task to be executing.
   */
  pollLongQueuedTasks(longTimeSeconds: number): void {
    pollLongQueuedTasks(
      this.config.store,
      longTimeSeconds,
      this.strategies.generatePollWaitTimesStrategy,
      this.config.leaseBehavior.registerRetryCallback,
      this.config.messaging
    )
  }

  /**
   * Monitor the scheduled jobs for expired leases.  This may indicate that the
   * lease times are too short, and need to be extended to handle the longer
   * operations.  Or, it could mean that some operation failed or a node
   * crashed, and may need repairs.
   *
   * Note that any discovered expired lease scheduled job may have its lease
   * stolen before it can be repaired.
   */
  pollScheduledJobsForExpiredLeases(): void {
    pollScheduledJobsForExpiredLeases(
      this.config.store,
      this.strategies.generatePollWaitTimesStrategy,
      this.strategies.currentTimeUTCStrategy,
      this.config.leaseBehavior.registerRetryCallback,
      this.config.messaging
    )
  }

  /**
   * Monitors for when a task is ready to initiate the job execution service.
   */
  pollTaskReadyToExecute(): void {
    pollTaskReadyToExecute(
      this.config.store,
      this.strategies.generatePollWaitTimesStrategy,
      this.config.leaseBehavior.registerRetryCallback,
      this.config.messaging
    )
  }
}


export {
  DataStore,
} from './datastore'

export {
  MessagingEvents,
  MessagingEventEmitter,
} from './messaging'

export {
  wireDataStore,
  pollLongExecutingTasks,
  pollLongQueuedTasks,
  pollScheduledJobsForExpiredLeases,
  pollScheduledJobsForTaskCreation,
  pollTaskReadyToExecute,
} from './wire'

export {
  createMemoryDataStore
} from './datastore/memory'

export {
  ExecutionJobId,
  JobExecutionManager,
  JobExecutionState,
  JobExecutionStateCompleted,
  JobExecutionStateFailed,
  JobExecutionStateRunning,
  StartJob,
  isJobExecutionStateCompleted,
  isJobExecutionStateFailed,
  isJobExecutionStateRunning,
} from './executor'

export {
  AllStrategies,
  CreateLeaseIdStrategy,
  CreateLeaseTimeInSecondsStrategy,
  CreatePrimaryKeyStrategy,
  CurrentTimeUTCStrategy,
  CurrentTimeUTCStrategyRegistry,
  DUPLICATE_TASK_RUN_NEW,
  DUPLICATE_TASK_SKIP_NEW,
  DuplicateTaskStrategy,
  DuplicateTaskStrategyRegistry,
  GeneratePollWaitTimesStrategy,
  GeneratePollWaitTimesStrategyRegistry,
  RegisterPollCallback,
  RetryTaskStrategy,
  RetryTaskStrategyRegistry,
  StrategyName,
  StrategyRegistry,
  TaskCreationStrategy,
  TaskCreationStrategyRegistry,
} from './strategies'


import EventEmitter from 'events'
import {
  DataStore
} from './datastore'
import {
  MessagingEventEmitter,
} from './messaging'
import {
  JobExecutionManager
} from './executor'
import {
  AllStrategies,
  CurrentTimeUTCStrategy,
  CreatePrimaryKeyStrategy,
  CreateLeaseIdStrategy,
  CreateLeaseTimeInSecondsStrategy,
  GeneratePollWaitTimesStrategy,
  TaskCreationStrategyRegistry,
  DuplicateTaskStrategyRegistry,
  RetryTaskStrategy,
  RetryTaskStrategyRegistry,
  RegisterPollCallback,
  CreateLeaseRetryTimeInSecondsStrategy,
  createStrategyRegistry,
} from './strategies'
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
  pollScheduledJobsForTaskCreation,
  pollTaskReadyToExecute,
} from './wire'
import {
  LeaseBehavior
} from './controller';
import { registerAlwaysRunDuplicateTaskStrategy, registerAlwaysSkipDuplicateTaskStrategy } from './strategies/duplicate-task';

const MILLISECONDS_PER_SECOND = 1000

/**
 * A public facing facade on top of all the fun stuff in the scheduler.
 */
export class TernScheduler implements AllStrategies {
  private readonly store: DataStore
  private readonly messaging: MessagingEventEmitter
  private readonly jobExecution: JobExecutionManager
  private readonly leaseBehavior: LeaseBehavior
  private readonly registerPollCallback: RegisterPollCallback

  private active: boolean = true

  readonly createPrimaryKeyStrategy: CreatePrimaryKeyStrategy
  readonly createLeaseIdStrategy: CreateLeaseIdStrategy
  readonly createLeaseTimeInSecondsStrategy: CreateLeaseTimeInSecondsStrategy
  readonly currentTimeUTCStrategy: CurrentTimeUTCStrategy
  readonly generatePollWaitTimesStrategy: GeneratePollWaitTimesStrategy

  readonly taskCreationStrategyRegistry: TaskCreationStrategyRegistry
  readonly duplicateTaskStrategyRegistry: DuplicateTaskStrategyRegistry
  readonly retryTaskStrategyRegistry: RetryTaskStrategyRegistry

  constructor(args: {
    store: DataStore
    jobExecution: JobExecutionManager
    createLeaseTimeInSecondsStrategy: CreateLeaseTimeInSecondsStrategy
    generatePollWaitTimesStrategy: GeneratePollWaitTimesStrategy
    retryLeaseTimeStrategy: CreateLeaseRetryTimeInSecondsStrategy

    createPrimaryKeyStrategy?: CreatePrimaryKeyStrategy
    createLeaseIdStrategy?: CreateLeaseIdStrategy
    currentTimeUTCStrategy?: CurrentTimeUTCStrategy
  }) {
    this.store = args.store
    this.jobExecution = args.jobExecution

    this.createLeaseTimeInSecondsStrategy = args.createLeaseTimeInSecondsStrategy
    this.generatePollWaitTimesStrategy = args.generatePollWaitTimesStrategy
    this.createPrimaryKeyStrategy = args.createPrimaryKeyStrategy || UUIDCreatePrimaryKeyStrategy
    this.createLeaseIdStrategy = args.createLeaseIdStrategy || UUIDCreateLeaseIdStrategy
    this.currentTimeUTCStrategy = args.currentTimeUTCStrategy || StandardTime

    this.taskCreationStrategyRegistry = createStrategyRegistry()
    this.duplicateTaskStrategyRegistry = createStrategyRegistry()
    registerAlwaysRunDuplicateTaskStrategy(this.duplicateTaskStrategyRegistry)
    registerAlwaysSkipDuplicateTaskStrategy(this.duplicateTaskStrategyRegistry)
    this.retryTaskStrategyRegistry = createStrategyRegistry()


    this.registerPollCallback = (delaySeconds, callback) => {
      if (this.active) {
        setTimeout(() => {
          if (this.active) {
            callback()
          }
        }, delaySeconds * MILLISECONDS_PER_SECOND)
      }
    }

    this.messaging = new EventEmitter()
    this.leaseBehavior = {
      leaseOwnerStrategy: this.createLeaseIdStrategy,
      leaseTimeSeconds: this.createLeaseTimeInSecondsStrategy(),
      retrySecondsDelay: args.retryLeaseTimeStrategy(),
      registerRetryCallback: this.registerPollCallback
    }

    this.jobExecution.withMessaging(this.messaging)
    wireDataStore(
      this.store,
      this.messaging,
      this.leaseBehavior,
      this.jobExecution,
      this.retryTaskStrategyRegistry,
      this.duplicateTaskStrategyRegistry,
      this.taskCreationStrategyRegistry,
      this.createPrimaryKeyStrategy,
      this.currentTimeUTCStrategy
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
      this.store,
      longTimeSeconds,
      this.generatePollWaitTimesStrategy,
      this.registerPollCallback,
      this.messaging
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
      this.store,
      longTimeSeconds,
      this.generatePollWaitTimesStrategy,
      this.registerPollCallback,
      this.messaging
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
      this.store,
      this.generatePollWaitTimesStrategy,
      this.currentTimeUTCStrategy,
      this.registerPollCallback,
      this.messaging
    )
  }

  /**
   * Monitor for when a scheduled job should have a new task "peeled" off.
   */
  pollScheduledJobsForTaskCreation(): void {
    pollScheduledJobsForTaskCreation(
      this.store,
      this.generatePollWaitTimesStrategy,
      this.currentTimeUTCStrategy,
      this.registerPollCallback,
      this.messaging
    )
  }

  /**
   * Monitors for when a task is ready to initiate the job execution service.
   */
  pollTaskReadyToExecute(): void {
    pollTaskReadyToExecute(
      this.store,
      this.generatePollWaitTimesStrategy,
      this.registerPollCallback,
      this.messaging
    )
  }
}

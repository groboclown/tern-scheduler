
import * as libExecutor from './lib/executor'
import * as libStrats from './lib/strategies'
import * as libModel from './lib/model'
import * as libDatastore from './lib/datastore'
import * as libDbApi from './lib/datastore/db-api'
import {
  JobExecutionEventEmitter as JobEmitter,
} from './lib/messaging'

export {
  PollingCallback,
  TernClient,
  TernConfiguration,
  TernScheduler,
} from './lib/basics'

export {
  DataStore,
  Page,
} from './lib/datastore'

export {
  MessagingEventEmitter,
  JobExecutionEventEmitter,
} from './lib/messaging'

export {
  pollLongExecutingTasks,
  pollLongQueuedTasks,
  pollScheduledJobsForExpiredLeases,
  pollTaskReadyToExecute,
} from './lib/wire'

export {
  createMemoryDataStore
} from './lib/datastore/memory'


export namespace executor {
  export type ExecutionJobId = libExecutor.ExecutionJobId
  export type JobExecutionManager = libExecutor.JobExecutionManager
  export type JobExecutionState = libExecutor.JobExecutionState
  export type JobExecutionStateCompleted = libExecutor.JobExecutionStateCompleted
  export type JobExecutionStateFailed = libExecutor.JobExecutionStateFailed
  export type JobExecutionStateRunning = libExecutor.JobExecutionStateRunning
  export type StartJob = libExecutor.StartJob

  // duplicate, so that it looks consistent
  export type JobExecutionEventEmitter = JobEmitter

  export const isJobExecutionStateCompleted = libExecutor.isJobExecutionStateCompleted
  export const isJobExecutionStateFailed = libExecutor.isJobExecutionStateFailed
  export const isJobExecutionStateRunning = libExecutor.isJobExecutionStateRunning
}

export namespace strategies {
  export type AllStrategies = libStrats.AllStrategies
  export type CreateLeaseIdStrategy = libStrats.CreateLeaseIdStrategy
  export type CreateLeaseTimeInSecondsStrategy = libStrats.CreateLeaseTimeInSecondsStrategy
  export type CreatePrimaryKeyStrategy = libStrats.CreatePrimaryKeyStrategy
  export type CurrentTimeUTCStrategy = libStrats.CurrentTimeUTCStrategy
  export type CurrentTimeUTCStrategyRegistry = libStrats.CurrentTimeUTCStrategyRegistry
  export type DuplicateTaskStrategy = libStrats.DuplicateTaskStrategy
  export type DuplicateTaskStrategyRegistry = libStrats.DuplicateTaskStrategyRegistry
  export type GeneratePollWaitTimesStrategy = libStrats.GeneratePollWaitTimesStrategy
  export type GeneratePollWaitTimesStrategyRegistry = libStrats.GeneratePollWaitTimesStrategyRegistry
  export type RegisterPollCallback = libStrats.RegisterPollCallback
  export type RetryTaskStrategy = libStrats.RetryTaskStrategy
  export type RetryTaskStrategyRegistry = libStrats.RetryTaskStrategyRegistry
  export type StrategyName = libStrats.StrategyName
  export type StrategyRegistry<T> = libStrats.StrategyRegistry<T>
  export type TaskCreationStrategy = libStrats.TaskCreationStrategy
  export type TaskCreationStrategyRegistry = libStrats.TaskCreationStrategyRegistry
  export type TaskCreationStrategyAfterCreation = libStrats.TaskCreationStrategyAfterCreation
  export type TaskCreationStrategyAfterFinish = libStrats.TaskCreationStrategyAfterFinish
  export type TaskCreationStrategyAfterStart = libStrats.TaskCreationStrategyAfterStart

  export const DUPLICATE_TASK_RUN_NEW = libStrats.DUPLICATE_TASK_RUN_NEW
  export const DUPLICATE_TASK_SKIP_NEW = libStrats.DUPLICATE_TASK_SKIP_NEW

  export const addUUIDCreateLeaseIdStrategy = libStrats.addUUIDCreateLeaseIdStrategy
  export const registerStandardTimeStrategy = libStrats.registerStandardTimeStrategy
  export const addUUIDCreatePrimaryKeyStrategy = libStrats.addUUIDCreatePrimaryKeyStrategy
}

export namespace datastore {
  export type ScheduledJobModel = libModel.ScheduledJobModel
  export type TaskModel = libModel.TaskModel
  export type PrimaryKeyType = libModel.PrimaryKeyType
  export type BaseModel = libModel.BaseModel
  export type ScheduleUpdateStateType = libModel.ScheduleUpdateStateType
  export type LeaseIdType = libModel.LeaseIdType
  export type TaskStateType = libModel.TaskStateType
  export type DatabaseDataStore = libDatastore.DatabaseDataStore
  export const DatabaseDataStore = libDatastore.DatabaseDataStore

  export const MODEL_PRIMARY_KEY = libModel.MODEL_PRIMARY_KEY
  export const TASK_STATE_PENDING = libModel.TASK_STATE_PENDING
  export const TASK_STATE_QUEUED = libModel.TASK_STATE_QUEUED
  export const TASK_STATE_STARTED = libModel.TASK_STATE_STARTED
  export const TASK_STATE_START_ERROR = libModel.TASK_STATE_START_ERROR
  export const TASK_STATE_COMPLETE_QUEUED = libModel.TASK_STATE_COMPLETE_QUEUED
  export const TASK_STATE_COMPLETE_ERROR = libModel.TASK_STATE_COMPLETE_ERROR
  export const TASK_STATE_FAILED = libModel.TASK_STATE_FAILED
  export const TASK_STATE_FAIL_RESTARTED = libModel.TASK_STATE_FAIL_RESTARTED
  export const TASK_STATE_COMPLETED = libModel.TASK_STATE_COMPLETED

  export namespace db {
    export type DataModel = libDbApi.DataModel
    export type Database = libDbApi.Database
    export type DbTableController<T extends libDbApi.DataModel> = libDbApi.DbTableController<T>
    export type ScheduledJobDataModel = libDbApi.ScheduledJobDataModel
    export type TaskDataModel = libDbApi.TaskDataModel
    export type Conditional<T extends libDbApi.DataModel> = libDbApi.Conditional<T>
    export type EqualsConditional<T extends DataModel, K extends keyof T> = libDbApi.EqualsConditional<T, K>
    export const EqualsConditional = libDbApi.EqualsConditional
    export const isEqualsConditional = libDbApi.isEqualsConditional
    export type BeforeDateConditional<T extends DataModel> = libDbApi.BeforeDateConditional<T>
    export const BeforeDateConditional = libDbApi.BeforeDateConditional
    export const isBeforeDateConditional = libDbApi.isBeforeDateConditional
    export type OneOfConditional<T extends DataModel, K extends keyof T> = libDbApi.OneOfConditional<T, K>
    export const OneOfConditional = libDbApi.OneOfConditional
    export const isOneOfConditional = libDbApi.isOneOfConditional
    export type AndConditional<T extends DataModel> = libDbApi.AndConditional<T>
    export const AndConditional = libDbApi.AndConditional
    export const isAndConditional = libDbApi.isAndConditional
    export type OrConditional<T extends DataModel> = libDbApi.OrConditional<T>
    export const OrConditional = libDbApi.OrConditional
    export const isOrConditional = libDbApi.isOrConditional
    export type NotNullConditional<T extends DataModel> = libDbApi.NotNullConditional<T>
    export const NotNullConditional = libDbApi.NotNullConditional
    export const isNotNullConditional = libDbApi.isNotNullConditional
    export type NullConditional<T extends DataModel> = libDbApi.NotNullConditional<T>
    export const NullConditional = libDbApi.NotNullConditional
    export const isNullConditional = libDbApi.isNotNullConditional
  }
}

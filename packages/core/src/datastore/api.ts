
import {
  LeaseIdType,
  BaseModel,
  ScheduledJobModel,
  TaskModel,
  PrimaryKeyType,
  TaskStateType,
  TASK_STATE_COMPLETE_ERROR,
  TASK_STATE_COMPLETE_QUEUED,
  TASK_STATE_FAILED,
  TASK_STATE_FAIL_RESTARTED,
} from '../model'
import {
  SCHEDULE_STATE_DISABLED,
  SCHEDULE_STATE_ACTIVE,
} from '../model/schedule'
import {
  ExecutionJobId
} from '../executor/types'

export interface Page<T extends BaseModel> {
  nextPageKey: string | null
  pageSize: number
  estimatedCount: number | null
  page: T[]
}

/**
 * Basic API building blocks used by the controllers to perform data model
 * handling in the backing data store.  Each method has precise meanings that
 * should be followed by the implementors.
 *
 * The write operations provided here are intended to be atomic.
 *
 * TODO allow for paging requests to include filters and sort.
 */
export interface DataStore {
  /**
   * Either creates or upgrades the backing schema.  If you are running
   * multiple scheduler services, this should be run outside the service
   * startup, and instead run as a stand-alone task.
   */
  updateSchema(): Promise<void>


  // ------------------------------------------------------------------------
  // Scheduled Job API

  /**
   * Adds the given model to the database.
   *
   * The promise fails with a `DataStoreError`, optionally with a more
   * specific error, such as
   * * `DuplicatePrimaryKeyError` - the primary key in the model is already
   *   in the database, or maybe was in the database at some previous time.
   *
   * @param model model to add
   */
  addScheduledJobModel(model: ScheduledJobModel, leaseId: LeaseIdType, now: Date, leaseTimeSeconds: number): Promise<void>

  getJob(pk: PrimaryKeyType): Promise<ScheduledJobModel | null>

  /**
   * Search for expired scheduled jobs.
   *
   * @param now
   * @param limit
   */
  pollLeaseExpiredScheduledJobs(now: Date, limit: number): Promise<ScheduledJobModel[]>

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
  getActiveScheduledJobs(pageKey: string | null, limit: number): Promise<Page<ScheduledJobModel>>

  /**
   * Just like `#getActiveScheduledJobs`, but for disabled jobs.
   *
   * @param pageKey opaque indicator for the starting page to read.
   * @param limit suggested maximum records returned
   */
  getDisabledScheduledJobs(pageKey: string | null, limit: number): Promise<Page<ScheduledJobModel>>

  /**
   * Attempts to disable the job.  If the job is already disabled, then this
   * returns a false value.  If the job could not be locked before disabling,
   * or if it is not in the data store, then an error is sent to the
   * promise's reject.
   *
   * Scheduled jobs cannot be enabled.  If you want to enable a job, you must
   * create a new one.
   *
   * @param job
   */
  disableScheduledJob(sched: ScheduledJobModel, leaseId: LeaseIdType): Promise<boolean>

  /**
   * Attempts to delete the job only if it is disabled.  If the job is not in
   * the data store, or not disabled, then this returns a false value.
   *
   * @param job
   */
  deleteScheduledJob(sched: ScheduledJobModel): Promise<boolean>

  /**
   * Create a lease on the scheduled job.  This must obtain the lease if and only if
   * the job is in the ACTIVE state.  The lease is never stolen.
   * Do not take the lease if it is not expired, even if the lease ID matches up.
   *
   * Errors are raised in the promise for:
   * * Lease could not be obtained (some other process has the lock)
   * * Job is not in the data store
   *
   * @param leaseId the lease ID is a custom value per lease operation.
   * @param now the date for right now; must be in UTC time zone; some data stores may instead
   *  ignore this value.
   * @param leaseTimeSeconds: number of seconds to reserve the lease for.
   */
  leaseScheduledJob(jobPk: PrimaryKeyType, leaseId: LeaseIdType, now: Date, leaseTimeSeconds: number): Promise<void>

  /**
   * Release the lease on the job and set its state to one of the given values.
   * The lease is released if and only if:
   * * The lease ID is set to the same as the lease ID in the request.
   * Expired leases are fine for this, because if the lease ID is not
   * different, then that means no other process stole the lease.
   *
   * On release, the lease ID and lease expiration should be set to null values.
   *
   * Errors are raised in the promise for:
   * * The lease was stolen by another process
   * * The job is not in the data store
   *
   * @param leaseId
   */
  releaseScheduledJobLease(leaseId: LeaseIdType, jobPk: PrimaryKeyType,
    releaseState: SCHEDULE_STATE_DISABLED | SCHEDULE_STATE_ACTIVE
  ): Promise<void>

  /**
   * Steal an expired lease.  Used by tasks that need to repair the lease state.
   * The lease is broken if and only if its state is UPDATING or REPAIR and the
   * lease expiration is before `now`.  The state after stealing is REPAIR.
   *
   * @param jobPk
   * @param newLeaseId
   * @param now
   * @param leaseTimeSeconds
   */
  repairExpiredLeaseForScheduledJob(jobPk: PrimaryKeyType, newLeaseId: LeaseIdType,
    now: Date, leaseTimeSeconds: number): Promise<void>

  /**
   * Mark the currently leased scheduled job as needing repair.  It does this by
   * setting the lease expiration to `now`, so that the scheduled job repair
   * polling mechanism can begin repairs to the scheduled job.
   *
   * @param jobPk
   * @param now
   */
  markLeasedScheduledJobNeedsRepair(jobPk: PrimaryKeyType, now: Date): Promise<void>


  // ------------------------------------------------------------------------
  // Task API

  /**
   * Find tasks that are eligible to begin execution.  Tasks eligible for
   * execution must be:
   * * execution time is on or before `now`
   * * task state is `pending`
   *
   * @param now the date for right now; must be in UTC time zone; some data stores may instead
   *  ignore this value.
   * @param limit suggested maximum records returned
   */
  pollExecutableTasks(now: Date, limit: number): Promise<TaskModel[]>

  /**
   * Find tasks who have the `executionQueued` time set on or before `now` minus the
   * `beforeSeconds`, and the state is QUEUED
   *
   * @param now the date for right now; must be in UTC time zone; some data stores may instead
   *  ignore this value.
   * @param leaseTimeSeconds: number of seconds to reserve the lease for.
   * @param limit suggested maximum records returned
   */
  pollLongQueuedTasks(now: Date, beforeSeconds: number, limit: number): Promise<TaskModel[]>

  /**
   * Find tasks who have the `executionStarted` time set on or before `now` minus the
   * `beforeSeconds`, and the state is STARTED.
   *
   * @param now the date for right now; must be in UTC time zone; some data stores may instead
   *  ignore this value.
   * @param leaseTimeSeconds: number of seconds to reserve the lease for.
   * @param limit suggested maximum records returned
   */
  pollLongExecutingTasks(now: Date, beforeSeconds: number, limit: number): Promise<TaskModel[]>

  /**
   * Get a page of all the tasks recorded as currently executing.  This is done while
   * ignoring lease states.
   *
   * @param pageKey opaque indicator for the starting page to read.
   * @param limit suggested maximum records returned
   */
  getExecutingTasks(pageKey: string, limit: number): Promise<Page<TaskModel>>

  /**
   * Get a page of all the tasks recorded as waiting to execute.  This is done while
   * ignoring lease states.
   *
   * @param pageKey opaque indicator for the starting page to read.
   * @param limit suggested maximum records returned
   */
  getPendingTasks(pageKey: string, limit: number): Promise<Page<TaskModel>>

  /**
   * Get a page of tasks which are in any of the "failed" states.
   */
  getFailedTasks(pageKey: string, limit: number, since?: Date): Promise<Page<TaskModel>>

  /**
   * Get a page of tasks which the job execution framework has marked as completed without
   * failure.
   *
   * @param pageKey
   * @param limit
   * @param since
   */
  getCompletedTasks(pageKey: string, limit: number, since?: Date): Promise<Page<TaskModel>>

  /**
   * Get a page of tasks which have finished execution, regardless of fail state.
   *
   * @param pageKey
   * @param limit
   * @param since
   */
  getFinishedTasks(pageKey: string, limit: number, since?: Date): Promise<Page<TaskModel>>

  /**
   * Create the specific task in the data store.
   *
   * As a write operation, this requires a lease on the owning scheduled job.  However,
   * the data store does not make any such assurances.
   *
   * @param task
   */
  addTask(task: TaskModel): Promise<void>

  /**
   * Fetch the task with the given primary key, or return null if it is not in the
   * data store.
   *
   * @param pk
   */
  getTask(pk: PrimaryKeyType): Promise<TaskModel | null>

  /**
   * Find the task with the registered execution job ID.
   *
   * @param execJobId
   */
  getTaskByExecutionJobId(execJobId: ExecutionJobId): Promise<TaskModel | null>

  /**
   * Find all the tasks that are in queued or running state with the scheduled job ID.  If none
   * are found, then an empty list is returned.
   *
   * @param scheduledJob
   * @param limit
   */
  getActiveTasksForScheduledJob(scheduledJob: ScheduledJobModel, limit: number): Promise<TaskModel[]>

  /**
   *
   * If the operation cannot set the state because the existing state isn't
   * correct, then an error is thrown.
   *
   * As a write operation, this requires a lease on the owning scheduled job.
   * However, the data store does not make any such assurances.
   *
   * @param task
   * @param now the date for right now; must be in UTC time zone; some data stores may instead
   *  ignore this value.
   */
  markTaskQueued(task: TaskModel, now: Date): Promise<void>

  /**
   *
   * If the operation cannot set the state because the existing state isn't
   * correct, then an error is thrown.
   *
   * As a write operation, this requires a lease on the owning scheduled job.
   * However, the data store does not make any such assurances.
   *
   * @param task
   * @param now the date for right now; must be in UTC time zone; some data stores may instead
   *  ignore this value.
   * @param executionId the execution job ID if it isn't set and if the task state is started.
   */
  markTaskStarted(task: TaskModel, now: Date, executionId: string): Promise<void>

  /**
   *
   * If the operation cannot set the state because the existing state isn't
   * correct, then an error is thrown.
   *
   * As a write operation, this requires a lease on the owning scheduled job.
   * However, the data store does not make any such assurances.
   *
   * @param task
   * @param now the date for right now; must be in UTC time zone; some data stores may instead
   *  ignore this value.
   */
  markTaskStartFailed(task: TaskModel, now: Date, reason: string): Promise<void>

  /**
   *
   * If the operation cannot set the state because the existing state isn't
   * correct, then an error is thrown.
   *
   * As a write operation, this requires a lease on the owning scheduled job.
   * However, the data store does not make any such assurances.
   *
   * @param task
   * @param now the date for right now; must be in UTC time zone; some data stores may instead
   *  ignore this value.
   */
  markTaskCompleted(task: TaskModel, now: Date, info: string): Promise<void>

  /**
   *
   * If the operation cannot set the state because the existing state isn't
   * correct, then an error is thrown.
   *
   * As a write operation, this requires a lease on the owning scheduled job.
   * However, the data store does not make any such assurances.
   *
   * @param task
   * @param now the date for right now; must be in UTC time zone; some data stores may instead
   *  ignore this value.
   */
  markTaskFailed(task: TaskModel, now: Date, expectedCurrentState: TaskStateType,
    failedState: TASK_STATE_COMPLETE_ERROR | TASK_STATE_COMPLETE_QUEUED |
      TASK_STATE_FAILED | TASK_STATE_FAIL_RESTARTED,
    info: string): Promise<void>

  /**
   * Attempts to delete the task marked as one of the finished states.
   *
   * Even though this is a write operation, it operates on a record which
   * has entered read-only mode, so it can run without a lease on the
   * parent scheduled job.
   */
  deleteFinishedTask(task: TaskModel): Promise<boolean>
}

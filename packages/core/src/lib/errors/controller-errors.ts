
import { TernError } from './base'
import {
  PrimaryKeyType,
  LeaseIdType,
  ScheduledJobModel,
  TaskStateType,
  TaskModel
} from '../model'
import {
  JobExecutionState,
  ALLOWED_EXECUTION_STATES,
} from '../executor'

export class LeaseError extends TernError {
  constructor(
    readonly ourLeaseId: LeaseIdType, readonly job: ScheduledJobModel,
    readonly leaseOwner: LeaseIdType | null, readonly leaseExpires: Date | null, message: string
  ) {
    super(`${message}; currently owned by ${leaseOwner} expires ${leaseExpires}`)

    // Error workaround fun
    this.name = LeaseError.name
    Object.setPrototypeOf(this, LeaseError.prototype)
  }
}

export class LeaseNotObtainedError extends LeaseError {
  constructor(ourLeaseId: LeaseIdType, job: ScheduledJobModel, leaseOwner: LeaseIdType | null, leaseExpires: Date | null) {
    super(ourLeaseId, job, leaseOwner, leaseExpires, `Could not obtain lease for ${ourLeaseId} against job ${job.pk}`)

    // Error workaround fun
    this.name = LeaseNotObtainedError.name
    Object.setPrototypeOf(this, LeaseNotObtainedError.prototype)
  }
}

export class LeaseNotOwnedError extends LeaseError {
  constructor(ourLeaseId: LeaseIdType, job: ScheduledJobModel, leaseOwner: LeaseIdType | null, leaseExpires: Date | null) {
    super(ourLeaseId, job, leaseOwner, leaseExpires, `Lease not currently owned for ${ourLeaseId} against job ${job.pk}`)

    // Error workaround fun
    this.name = LeaseNotOwnedError.name
    Object.setPrototypeOf(this, LeaseNotOwnedError.prototype)
  }
}

export class LeaseExpiredError extends LeaseError {
  constructor(ourLeaseId: LeaseIdType, job: ScheduledJobModel, leaseOwner: LeaseIdType | null, leaseExpires: Date | null) {
    super(ourLeaseId, job, leaseOwner, leaseExpires,
      `Could not release lease for ${ourLeaseId} against job ${job.pk} due to another operation stole the lease because it was expired`)

    // Error workaround fun
    this.name = LeaseExpiredError.name
    Object.setPrototypeOf(this, LeaseExpiredError.prototype)
  }
}

export class ScheduledJobNotFoundError extends TernError {
  constructor(readonly jobPk: PrimaryKeyType) {
    super(`No such scheduled job ${jobPk}`)

    // Error workaround fun
    this.name = ScheduledJobNotFoundError.name
    Object.setPrototypeOf(this, ScheduledJobNotFoundError.prototype)
  }
}

export class TaskNotFoundError extends TernError {
  constructor(readonly taskPk: PrimaryKeyType) {
    super(`No such task ${taskPk}`)

    // Error workaround fun
    this.name = TaskNotFoundError.name
    Object.setPrototypeOf(this, TaskNotFoundError.prototype)
  }
}

export class InvalidTaskStateError extends TernError {
  constructor(readonly task: TaskModel, readonly newState: TaskStateType, readonly expectedState: TaskStateType) {
    super(`Could not update task ${task.pk} to state ${newState}: expected existing state ${expectedState}, found ${task.state}`)

    // Error workaround fun
    this.name = InvalidTaskStateError.name
    Object.setPrototypeOf(this, InvalidTaskStateError.prototype)
  }
}

export class InvalidJobExecutionStatusError extends TernError {
  constructor(readonly jobExecutionState: JobExecutionState) {
    super(`Unknown job execution state: ${JSON.stringify(jobExecutionState)}; "state" must be one of ${ALLOWED_EXECUTION_STATES}`)

    // Error workaround fun
    this.name = InvalidJobExecutionStatusError.name
    Object.setPrototypeOf(this, InvalidJobExecutionStatusError.prototype)
  }
}


export type ExecutionJobId = string

export interface JobExecutionState {
  state: string
}

export const EXECUTION_RUNNING = 'running'
export type EXECUTION_RUNNING = 'running'

export interface JobExecutionStateRunning extends JobExecutionState {
  state: EXECUTION_RUNNING
  jobId: ExecutionJobId
}

export function isJobExecutionStateRunning(v: JobExecutionState): v is JobExecutionStateRunning {
  return v.state === EXECUTION_RUNNING
}

export const EXECUTION_DID_NOT_START = 'did-not-start'
export type EXECUTION_DID_NOT_START = 'did-not-start'

/**
 * Generated when there was a basic configuration issue with the task generation.
 * It should only be used if the scheduled job will never create a valid value.
 * In cases where the execution framework can't be contacted or was configured
 * wrong, then a standard error should be used instead.
 *
 * Once this is generated, the scheduled job is disabled.
 */
export interface JobExecutionStateDidNotStart extends JobExecutionState {
  state: EXECUTION_DID_NOT_START
  result?: string
}

export function isJobExecutionStateDidNotStart(v: JobExecutionState): v is JobExecutionStateDidNotStart {
  return v.state === EXECUTION_DID_NOT_START
}

export const EXECUTION_COMPLETED = 'completed'
export type EXECUTION_COMPLETED = 'completed'

export interface JobExecutionStateCompleted extends JobExecutionState {
  state: EXECUTION_COMPLETED
  jobId: ExecutionJobId
  result?: string
}

export function isJobExecutionStateCompleted(v: JobExecutionState): v is JobExecutionStateCompleted {
  return v.state === EXECUTION_COMPLETED
}

export const EXECUTION_FAILED = 'failed'
export type EXECUTION_FAILED = 'failed'

export interface JobExecutionStateFailed extends JobExecutionState {
  state: EXECUTION_FAILED
  jobId: ExecutionJobId
  result?: string
}

export function isJobExecutionStateFailed(v: JobExecutionState): v is JobExecutionStateFailed {
  return v.state === EXECUTION_FAILED
}

export const ALLOWED_EXECUTION_STATES = [
  EXECUTION_COMPLETED,
  EXECUTION_DID_NOT_START,
  EXECUTION_FAILED,
  EXECUTION_RUNNING,
]

/**
 * Attempts to start the job.  If the job framework encounters an error that means the job
 * cannot be setup to run, then this fails.  If the framework can be contact, but job is not
 * allowed to run, then that should be reported to the message events as a failure condition,
 * so that the retry logic can decide how to handle the issue.
 */
export type StartJob = (taskId: string, jobName: string, context: string) => Promise<JobExecutionState>


export type ExecutionJobId = string

/**
 * Attempts to start the job.  If the job framework encounters an error that means the job
 * cannot be setup to run, then this fails.  If the framework can be contact, but job is not
 * allowed to run, then that should be reported to the message events as a failure condition,
 * so that the retry logic can decide how to handle the issue.
 */
export type StartJob = (taskId: string, jobName: string, context: string) => Promise<ExecutionJobId>

export interface JobExecutionState {
  state: string
}

export interface JobExecutionStateRunning extends JobExecutionState {
  state: 'running'
}

export function isJobExecutionStateRunning(v: JobExecutionState): v is JobExecutionStateRunning {
  return v.state === 'running'
}

export interface JobExecutionStateCompleted extends JobExecutionState {
  state: 'completed',
  result: string
}

export function isJobExecutionStateCompleted(v: JobExecutionState): v is JobExecutionStateCompleted {
  return v.state === 'completed'
}

export interface JobExecutionStateFailed extends JobExecutionState {
  state: 'failed',
  result: string
}

export function isJobExecutionStateFailed(v: JobExecutionState): v is JobExecutionStateFailed {
  return v.state === 'failed'
}

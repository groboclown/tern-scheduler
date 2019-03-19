import {
  StartJob,
  JobExecutionState,
} from './types'
import {
  JobExecutionEventEmitter,
} from '../messaging'
import { TaskModel } from '../model'

export interface JobExecutionManager {

  /**
   * Tells the job execution framework to begin running a job.
   */
  startJob: StartJob

  /**
   * Connect the job execution framework to the event emitter for this node.
   * The events are limited within this emitter to sending completion notices,
   * but any underlying messaging system is free to pass whatever it needs.
   *
   * @param messaging
   */
  withMessaging(messaging: JobExecutionEventEmitter): this

  /**
   * Used during the repair phase, when Tern needs to know if a task request
   * to start an execution ever was sent.  The job framework should do its best
   * to determine whether the given task was launched or not, because this
   * determines whether the job framework should try to rerun it or not.
   * 
   * If the job framework is aware of the request but hasn't actually launched
   * the job yet, it should still report "running", as that's the corresponding
   * state to the scheduler.
   */
  getTaskInitiatedJobState(task: TaskModel): Promise<JobExecutionState>
}

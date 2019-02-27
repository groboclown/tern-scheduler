import {
  StartJob,
} from './types'
import {
  JobExecutionEventEmitter,
} from '../messaging'


export interface JobExecutionManager {
  /**
   * Connect the job execution framework to the event emitter for this node.
   * The events are limited within this emitter to sending completion notices,
   * but any underlying messaging system is free to pass whatever it needs.
   *
   * @param messaging
   */
  withMessaging(messaging: JobExecutionEventEmitter): this

  /**
   * Tells the job execution framework to begin running a job.
   */
  startJob: StartJob
}

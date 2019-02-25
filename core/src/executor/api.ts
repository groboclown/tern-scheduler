import {
  ExecutionJobId,
  JobExecutionState,
  StartJob,
} from './types'
import {
  MessagingEvents,
  MessagingEventEmitter,
} from '../messaging'


export interface JobExecutionManager {
  withMessaging(messaging: MessagingEventEmitter): JobExecutionManager
  startJob: StartJob
}

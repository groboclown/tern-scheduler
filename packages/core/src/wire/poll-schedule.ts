import {
  DataStore
} from '../datastore'
import {
  MessagingEventEmitter
} from '../messaging'
import {
  GeneratePollWaitTimesStrategy,
  RegisterPollCallback,
  CurrentTimeUTCStrategy,
} from '../strategies'
import { pollLoop } from '../strategies/poll'

const POLL_JOBS_LIMIT = 10

/**
 * Polls the data store for scheduled jobs ready to create tasks.
 */
export function pollScheduledJobsForTaskCreation(
  store: DataStore,
  pollStrat: GeneratePollWaitTimesStrategy,
  currentTimeUTC: CurrentTimeUTCStrategy,
  registerPoll: RegisterPollCallback,
  messaging: MessagingEventEmitter
): void {
  pollLoop(pollStrat, registerPoll, () => store
    .pollTaskableScheduledJobs(currentTimeUTC(), POLL_JOBS_LIMIT)
    .then(jobs => {
      jobs.forEach(job => {
        messaging.emit('scheduledJobTaskCheck', job)
      })
    })
    .catch(e => {
      messaging.emit('generalError', e)
      // Don't stop with this one error; keep running the poll
      return Promise.resolve()
    }))
}


export function pollScheduledJobsForExpiredLeases(
  store: DataStore,
  pollStrat: GeneratePollWaitTimesStrategy,
  currentTimeUTC: CurrentTimeUTCStrategy,
  registerPoll: RegisterPollCallback,
  messaging: MessagingEventEmitter
): void {
  pollLoop(pollStrat, registerPoll, () => store
    .pollLeaseExpiredScheduledJobs(currentTimeUTC(), POLL_JOBS_LIMIT)
    .then(jobs => {
      jobs.forEach(job => {
        messaging.emit('scheduledJobLeaseExpired', job)
      })
    })
    .catch(e => {
      messaging.emit('generalError', e)
      // Don't stop with this one error; keep running the poll
      return Promise.resolve()
    })
  )
}

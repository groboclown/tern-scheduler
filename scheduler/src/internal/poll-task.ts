
import {
  DataStore
} from "../datastore"
import {
  MessagingEventEmitter
} from "../messaging"
import {
  GeneratePollWaitTimesStrategy,
  RegisterPollCallback,
} from "../strategies";
import { TernError } from "../errors"
import { currentTimeUTC } from "./time-util";
import { pollLoop } from "../strategies/poll";

const POLL_TASKS_LIMIT = 10

export function pollTaskReadyToExecute(
  store: DataStore,
  pollStrat: GeneratePollWaitTimesStrategy,
  registerPoll: RegisterPollCallback,
  messaging: MessagingEventEmitter
): void {
  pollLoop(pollStrat, registerPoll, () => store
    .pollExecutableTasks(currentTimeUTC(), POLL_TASKS_LIMIT)
    .then(tasks => {
      tasks.forEach(task => {
        messaging.emit('taskReadyToExecute', task)
      })
    })
    .catch(e => {
      messaging.emit('generalError', e)
      return Promise.resolve()
    })
  )
}


export function pollLongQueuedTasks(
  store: DataStore,
  timeoutSeconds: number,
  pollStrat: GeneratePollWaitTimesStrategy,
  registerPoll: RegisterPollCallback,
  messaging: MessagingEventEmitter
): void {
  pollLoop(pollStrat, registerPoll, () => store
    .pollLongQueuedTasks(currentTimeUTC(), timeoutSeconds, POLL_TASKS_LIMIT)
    .then(tasks => {
      tasks.forEach(task => {
        messaging.emit('taskQueuedLong', task)
      })
    })
    .catch(e => {
      messaging.emit('generalError', e)
      return Promise.resolve()
    })
  )
}

export function pollLongExecutingTasks(
  store: DataStore,
  timeoutSeconds: number,
  pollStrat: GeneratePollWaitTimesStrategy,
  registerPoll: RegisterPollCallback,
  messaging: MessagingEventEmitter
): void {
  pollLoop(pollStrat, registerPoll, () => store
    .pollLongExecutingTasks(currentTimeUTC(), timeoutSeconds, POLL_TASKS_LIMIT)
    .then(tasks => {
      tasks.forEach(task => {
        messaging.emit('taskExecutingLong', task)
      })
    })
    .catch(e => {
      messaging.emit('generalError', e)
      return Promise.resolve()
    })
  )
}

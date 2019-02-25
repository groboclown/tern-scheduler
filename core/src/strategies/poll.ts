
import {
  StrategyName,
  StrategyRegistry,
} from './api'
import { TernError } from '../errors'

export type PollWaitTimes = number[]

/**
 * Register a single callback to run after about `delaySeconds` time.  If the
 * polling should stop, this will ignore the request to register another callback,
 * or, at the callback time, will not call the callback.
 */
export type RegisterPollCallback = (delaySeconds: number, callback: () => void) => void

export type GeneratePollWaitTimesStrategy =
  () => PollWaitTimes


/**
 * Performs the general polling loop.  The callback should handle its own
 * errors.
 *
 * @param pollStrat
 * @param callback
 */
export function pollLoop(
  pollStrat: GeneratePollWaitTimesStrategy,
  registerPollCallback: RegisterPollCallback,
  onPoll: () => Promise<any>
): void {
  const pollTimes = pollStrat()
  if (pollTimes.length <= 0) {
    throw new TernError(`Invalid poll times: no values`)
  }
  let pollIndex = 0
  const pollCallback = () => {
    const pollTime = pollTimes[pollIndex]
    pollIndex = (pollIndex + 1) % pollTimes.length
    onPoll()
      .then(() => registerPollCallback(pollTime, pollCallback))
    // If the registerPollCallback call raises an error, it's a bad day.
  }
}


export interface GeneratePollWaitTimesStrategyRegistry extends StrategyRegistry<GeneratePollWaitTimesStrategy> {

}

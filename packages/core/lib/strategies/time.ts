
import {
  StrategyRegistry,
} from './api'
import {
  currentTimeUTC
} from '../internal/time-util'

/**
 * Returns the current date/time in UTC time zone.  There is generally just
 * one implementation for this, but it's useful for unit tests.
 */
export type CurrentTimeUTCStrategy =
  () => Date

export interface CurrentTimeUTCStrategyRegistry extends StrategyRegistry<CurrentTimeUTCStrategy> {

}

// Default strategy used by everything except unit tests.

export const StandardTime: CurrentTimeUTCStrategy = currentTimeUTC

export const STANDARD_TIME_STRATEGY = 'standard'

export function registerStandardTimeStrategy(reg: CurrentTimeUTCStrategyRegistry) {
  reg.register(STANDARD_TIME_STRATEGY, StandardTime)
}

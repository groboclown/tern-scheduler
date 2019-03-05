
import {
  toUTC
} from './convert'

export function currentTimeUTC(): Date {
  const now = CurrentTime.get()
  return toUTC(now)
}

// Fetches the current time in the current timezone.
// Note that this is here to allow for mocking with unit tests.
export const CurrentTime = {
  get: (): Date => {
    return new Date()
  },
}

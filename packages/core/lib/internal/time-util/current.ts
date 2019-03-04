
import {
  toUTC
} from './convert'

export function currentTimeUTC(): Date {
  const now = CurrentTime.get()
  return toUTC(now)
}

export const CurrentTime = {
  get: (): Date => {
    return new Date()
  },
}

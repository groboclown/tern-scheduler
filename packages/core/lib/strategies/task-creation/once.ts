import {
  TimeStruct, isTimeStruct, fromTimeStruct
} from '../../internal/time-util'
import {
  TaskCreationStrategyAfterCreation,
  TaskCreationStrategyRegistry
} from '.'
import { ScheduledJobModel } from '../../model'
import { isObject } from 'util'
import { InvalidScheduleDefinitionError } from '../../errors/strategy-errors'


export const SCHEDULE_ONCE_STRATEGY = 'once'

/**
 * Fire the job just once, at a specific time in the future.  It is
 * up to the creator of this object to translate the time from the
 * request into UTC timezone.
 */
export interface ScheduleOnceModel {
  /**
   * Date and time to run the job, in UTC time zone.  Note that if
   * the underlying data store has its own timezone, then the data store
   * implementation must translate that to UTC.
   */
  readonly executeAt: TimeStruct
}


export function registerOnceTaskCreationStrategy(registry: TaskCreationStrategyRegistry): void {
  registry.register(SCHEDULE_ONCE_STRATEGY, OnceTascCreationStrategy)
}


export function isScheduleOnceModel(v: any): v is ScheduleOnceModel {
  return isObject(v) && isTimeStruct(v.executeAt)
}


export const OnceTascCreationStrategy: TaskCreationStrategyAfterCreation = {
  after: 'new',

  createFromNewSchedule: (now: Date, schedule: ScheduledJobModel): Date => {
    // Even if the "now" is long after the schedule's time, let it be run.
    const once = getScheduleDefinition(schedule)
    return fromTimeStruct(once.executeAt)
  },
}


function getScheduleDefinition(schedule: ScheduledJobModel): ScheduleOnceModel {
  const defStr = schedule.scheduleDefinition
  let def: any
  try {
    def = JSON.parse(defStr)
  } catch (e) {
    throw new InvalidScheduleDefinitionError(schedule.pk, defStr, `Not valid json: ${e}`)
  }
  if (!isScheduleOnceModel(def)) {
    throw new InvalidScheduleDefinitionError(schedule.pk, defStr,
      `Not valid "${SCHEDULE_ONCE_STRATEGY}" schedule definition`)
  }
  return def
}

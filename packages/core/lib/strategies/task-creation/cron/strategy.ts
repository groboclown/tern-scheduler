import {
  TaskCreationStrategyAfterStart,
  TaskCreationAction,
  TaskCreationDisable,
  TaskCreationQueue,
  TaskCreationStrategyRegistry,
} from '../api'
import { ScheduledJobModel } from '../../../model'
import { InvalidScheduleDefinitionError } from '../../../errors/strategy-errors'
import {
  ScheduleCronModel,
  isScheduleCronModel,
} from './api'
import {
  nextCronTime,
  MAXIMUM_YEAR_IN_FUTURE,
} from './next'

// TODO split this file into multiple files to make it easier to understand.


export const SCHEDULE_CRON_MODEL = 'cron'


export function addCronTaskCreationStrategy(registry: TaskCreationStrategyRegistry): void {
  registry.register(SCHEDULE_CRON_MODEL, CronTaskCreationStrategy)
}


export const CronTaskCreationStrategy: TaskCreationStrategyAfterStart = {
  after: 'start',

  createFromNewSchedule: (now: Date, schedule: ScheduledJobModel): Date => {
    const model = getScheduleDefinition(schedule)
    const ret = nextCronTime(model, now)
    if (!ret) {
      throw new InvalidScheduleDefinitionError(
        schedule.pk, schedule.scheduleDefinition,
        `No first scheduled time within ${MAXIMUM_YEAR_IN_FUTURE} years`
      )
    }
    return ret
  },

  createAfterTaskStarts: (now: Date, schedule: ScheduledJobModel): TaskCreationAction => {
    const model = getScheduleDefinition(schedule)
    const ret = nextCronTime(model, now)
    if (!ret) {
      return { action: 'disable' } as TaskCreationDisable
    }
    return {
      action: 'queue',
      runAt: ret,
    } as TaskCreationQueue
  },
}


function getScheduleDefinition(schedule: ScheduledJobModel): ScheduleCronModel {
  const defStr = schedule.scheduleDefinition
  let def: any
  try {
    def = JSON.parse(defStr)
  } catch (e) {
    throw new InvalidScheduleDefinitionError(schedule.pk, defStr, `Not valid json: ${e}`)
  }
  if (!isScheduleCronModel(def)) {
    throw new InvalidScheduleDefinitionError(schedule.pk, defStr, `Not valid schedule definition`)
  }
  return def
}

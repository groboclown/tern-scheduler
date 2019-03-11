

export {
  CronModel,
  ScheduleCronModel,
  isScheduleCronModel,
} from './api'
export {
  CronTaskCreationStrategy,
  SCHEDULE_CRON_STRATEGY,
  registerCronTaskCreationStrategy,
} from './strategy'

import {
  cronToModel,
} from './expression'
import {
  ScheduleCronModel,
} from './api'

export function cronToDefinition(cronExpression: string): ScheduleCronModel {
  return {
    ...cronToModel(cronExpression),
    cronExpression,
    utcOffsetMinutes: 0,
    startAfter: null,
    endBy: null,
  } as ScheduleCronModel
}


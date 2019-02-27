import { Model } from 'sequelize-typescript'
import { ScheduledJob } from './schedule.model'
import { Task } from './task.model'

export { ScheduledJob } from './schedule.model'
export { Task } from './task.model'


export function getModels(): typeof Model[] {
  return [ScheduledJob, Task]
}

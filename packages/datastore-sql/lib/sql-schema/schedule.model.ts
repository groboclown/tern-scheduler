import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType
} from 'sequelize-typescript'


import {
  ScheduleStateType
} from '@tern-scheduler/core/lib/model'
import {
  ScheduledJobDataModel
} from '@tern-scheduler/core/lib/datastore/db-api';


@Table({
  tableName: 'SCHEDULE'
})
export class ScheduledJob extends Model<ScheduledJob> implements ScheduledJobDataModel {
  @PrimaryKey
  @Column({
    type: DataType.STRING(64),
    allowNull: false
  })
  pk!: string

  @Column({
    type: DataType.STRING(64)
  })
  leaseOwner!: string | null

  @Column({
    type: DataType.DATE
  })
  leaseExpires!: Date | null

  @Column({
    type: DataType.STRING(64),
    allowNull: false
  })
  state!: ScheduleStateType

  @Column({
    type: DataType.STRING(256),
    allowNull: false
  })
  displayName!: string

  @Column({
    type: DataType.STRING(2048),
    allowNull: false
  })
  description!: string

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
  createdOn!: Date

  @Column({
    type: DataType.STRING(64),
    allowNull: false
  })
  duplicateStrategy!: string

  @Column({
    type: DataType.STRING(64),
    allowNull: false
  })
  retryStrategy!: string

  // Job details.

  @Column({
    type: DataType.STRING(256),
    allowNull: false
  })
  jobName!: string

  @Column({
    type: DataType.TEXT,
    allowNull: false
  })
  jobContext!: string

  @Column({
    type: DataType.STRING(64),
    allowNull: false
  })
  taskCreationStrategy!: string

  @Column({
    type: DataType.TEXT,
    allowNull: false
  })
  scheduleDefinition!: string
}

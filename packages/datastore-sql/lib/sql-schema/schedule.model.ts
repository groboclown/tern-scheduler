import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType
} from 'sequelize-typescript'

import { datastore } from '@tern-scheduler/core'

@Table({
  tableName: 'SCHEDULE'
})
export class ScheduledJob extends Model<ScheduledJob> implements datastore.db.ScheduledJobDataModel {
  // ---------------------------------------
  // BaseModel
  @PrimaryKey
  @Column({
    type: DataType.STRING(64),
    allowNull: false
  })
  pk!: datastore.PrimaryKeyType

  // ---------------------------------------
  // ScheduledJobDataModel
  @Column({
    type: DataType.STRING(64)
  })
  leaseOwner!: datastore.LeaseIdType | null

  @Column({
    type: DataType.DATE
  })
  leaseExpires!: Date | null

  // ---------------------------------------
  // ScheduledJobModel
  @Column({
    type: DataType.STRING(64)
  })
  updateState!: datastore.ScheduleUpdateStateType | null

  @Column({
    type: DataType.STRING(64)
  })
  updateTaskPk!: datastore.PrimaryKeyType | null

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false
  })
  pasture!: boolean

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

  @Column({
    type: DataType.STRING(64)
  })
  previousSchedule!: datastore.PrimaryKeyType | null

  @Column({
    type: DataType.STRING(256)
  })
  previousReason!: string | null
}

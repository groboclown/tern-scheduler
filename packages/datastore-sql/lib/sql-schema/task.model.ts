import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
} from 'sequelize-typescript'

import {
  TaskStateType
} from '@tern-scheduler/core/lib/model'
import {
  TaskDataModel
} from '@tern-scheduler/core/lib/datastore/db-api';


@Table({
  tableName: 'TASK'
})
export class Task extends Model<Task> implements TaskDataModel {
  @PrimaryKey
  @Column({
    type: DataType.STRING(64),
    allowNull: false
  })
  pk!: string

  // Foreign key stuff is only used as a marker;
  // the datastore code does its own lookups.
  // @ForeignKey(() => Schedule)
  @Column({
    type: DataType.STRING(64),
    allowNull: false
  })
  schedule!: string

  @Column({
    type: DataType.STRING(64),
    allowNull: false
  })
  state!: TaskStateType

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
  createdOn!: Date

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
  executeAt!: Date

  @Column({
    type: DataType.DATE
  })
  executionJobId!: string | null

  @Column({
    type: DataType.DATE
  })
  executionQueued!: Date | null

  @Column({
    type: DataType.DATE
  })
  executionStarted!: Date | null

  @Column({
    type: DataType.DATE
  })
  executionFinished!: Date | null

  @Column({
    type: DataType.DATE
  })
  nextTimeoutCheck!: Date | null

  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  retryIndex!: number

  @Column({
    type: DataType.TEXT
  })
  completedInfo!: string | null

}

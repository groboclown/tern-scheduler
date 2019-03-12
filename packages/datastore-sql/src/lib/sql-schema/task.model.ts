import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
} from 'sequelize-typescript'

import { datastore } from '@tern-scheduler/core'

@Table({
  tableName: 'TERN_TASK',
})
export class Task extends Model<Task> implements datastore.db.TaskDataModel {
  @PrimaryKey
  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  pk!: string

  // Foreign key stuff is only used as a marker;
  // the datastore code does its own lookups.
  // @ForeignKey(() => Schedule)
  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  schedule!: string

  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  state!: datastore.TaskStateType

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  createdOn!: Date

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  executeAt!: Date

  @Column({
    type: DataType.STRING(128),
  })
  executionJobId!: string | null

  @Column({
    type: DataType.DATE,
  })
  executionQueued!: Date | null

  @Column({
    type: DataType.DATE,
  })
  executionStarted!: Date | null

  @Column({
    type: DataType.DATE,
  })
  executionFinished!: Date | null

  @Column({
    type: DataType.DATE,
  })
  nextTimeoutCheck!: Date | null

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  retryIndex!: number

  @Column({
    type: DataType.TEXT,
  })
  completedInfo!: string | null

}

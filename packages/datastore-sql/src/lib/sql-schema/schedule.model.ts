import {
  Sequelize,
  Model,
  STRING,
  DATE,
  BOOLEAN,
  TEXT,
} from 'sequelize'

export function createScheduledJobModel(sequelize: Sequelize): typeof Model & Model {
  return sequelize.define('TERN_SCHEDULE', {
    // ---------------------------------------
    // BaseModel
    pk: {
      type: STRING(64), // datastore.PrimaryKeyType
      allowNull: false,
      primaryKey: true,
    },

    // ---------------------------------------
    // ScheduledJobDataModel
    leaseOwner: {
      type: STRING(64), // datastore.LeaseIdType
      allowNull: true,
    },
    leaseExpires: {
      type: DATE, // Date | null
      allowNull: true,
    },

    // ---------------------------------------
    // ScheduledJobModel
    updateState: {
      type: STRING(64), // datastore.ScheduleUpdateStateType | null
      allowNull: true,
    },
    updateTaskPk: {
      type: STRING(64), // datastore.PrimaryKeyType | null
      allowNull: true,
    },
    pasture: {
      type: BOOLEAN, // boolean
      allowNull: false,
    },
    pastureReason: {
      type: STRING(255), // string | null
      allowNull: true,
    },
    displayName: {
      type: STRING(255), // string
      allowNull: false,
    },
    description: {
      type: STRING(2047), // string
      allowNull: false,
    },
    createdOn: {
      type: DATE, // Date
      allowNull: false,
    },
    duplicateStrategy: {
      type: STRING(64), // string
      allowNull: false,
    },
    retryStrategy: {
      type: STRING(64), // string
      allowNull: false,
    },
    jobName: {
      type: STRING(255), // string
      allowNull: false,
    },
    jobContext: {
      type: TEXT, // string
      allowNull: false,
    },
    taskCreationStrategy: {
      type: STRING(64), // string
      allowNull: false,
    },
    scheduleDefinition: {
      type: TEXT, // string
      allowNull: false,
    },
    previousSchedule: {
      type: STRING(64), // datastore.PrimaryKeyType | null
      allowNull: true,
    },
    previousReason: {
      type: STRING(256), // string | null
      allowNull: true,
    },
    repairState: {
      type: TEXT, // string | null
      allowNull: true,
    },
  }, {
      timestamps: false,
      paranoid: false,
      underscored: true,
      freezeTableName: false,
      tableName: 'TERN_SCHEDULE',
    }
  ) as (typeof Model & Model)
}

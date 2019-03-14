import {
  Sequelize,
  Model,
  STRING,
  DATE,
  INTEGER,
  TEXT,
} from 'sequelize'

export function createTaskModel(sequelize: Sequelize): typeof Model & Model {
  return sequelize.define('TERN_TASK', {
    // ---------------------------------------
    // BaseModel

    pk: {
      type: STRING(64), // datastore.PrimaryKeyType
      primaryKey: true,
      allowNull: false,
    },

    // ---------------------------------------
    // TaskDataModel

    // ---------------------------------------
    // TaskModel
    schedule: {
      type: STRING(64), // datastore.PrimaryKeyType
      // references: { model: 'TERN_SCHEDULE', key: 'pk' },
      allowNull: false,
    },
    state: {
      type: STRING(64), // datastore.TaskStateType
      allowNull: false,
    },
    createdOn: {
      type: DATE, // Date
      allowNull: false,
    },
    executeAt: {
      type: DATE, // Date
      allowNull: false,
    },
    executionJobId: {
      type: STRING(255), // string | null
      allowNull: true,
    },
    executionQueued: {
      type: DATE, // Date | null
      allowNull: true,
    },
    executionStarted: {
      type: DATE, // Date | null
      allowNull: true,
    },
    executionFinished: {
      type: DATE, // Date | null
      allowNull: true,
    },
    nextTimeoutCheck: {
      type: DATE, // Date | null
      allowNull: true,
    },
    retryIndex: {
      type: INTEGER, // number
      allowNull: false,
    },
    completedInfo: {
      type: TEXT, // string | null
      allowNull: true,
    },
  }, {
      timestamps: false,
      paranoid: false,
      underscored: true,
      freezeTableName: false,
      tableName: 'TERN_TASK',
    }
  ) as (typeof Model & Model)
}

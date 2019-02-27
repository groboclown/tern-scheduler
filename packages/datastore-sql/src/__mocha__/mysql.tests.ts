import { Sequelize } from 'sequelize-typescript'
import {
  standardDataStoreTests
} from './all-datastores'

describe('MySql compatibility', () => {
  const mysqlDb = process.env.MYSQL_DB
  const mysqlUser = process.env.MYSQL_USERNAME
  const mysqlPasswd = process.env.MYSQL_PASSWORD
  if (!mysqlDb || !mysqlUser || !mysqlPasswd) {
    describe('no mysql compatiblity setup', () => {
      it('requires env values MYSQL_DB and MYSQL_USERNAME and MYSQL_PASSWORD', () => {
        // Do nothing.  Here only to mark that the MySQL tests weren't run.
      })
    })
    return
  }

  const sequelize = new Sequelize({
    database: mysqlDb,
    username: mysqlUser,
    password: mysqlPasswd,
    dialect: 'sqlite',
  })

  standardDataStoreTests(sequelize)
})

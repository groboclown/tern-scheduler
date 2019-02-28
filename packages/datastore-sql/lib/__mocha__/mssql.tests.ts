import { Sequelize } from 'sequelize-typescript'
import {
  standardDataStoreTests
} from './all-datastores'

describe('Microsoft Sql compatibility', () => {
  const sqlDb = process.env.MSSQL_DB
  const sqlHost = process.env.MSSQL_HOST
  const sqlUser = process.env.MSSQL_USERNAME
  const sqlPasswd = process.env.MSSQL_PASSWORD
  if (!sqlDb || !sqlUser || !sqlPasswd || !sqlHost) {
    describe('no mssql compatiblity setup', () => {
      it('requires env values MSSQL_DB and MSSQL_HOST and MSSQL_USERNAME and MSSQL_PASSWORD', () => {
        // Do nothing.  Here only to mark that the MSSQL tests weren't run.
      })
    })
    return
  }

  const sequelize = new Sequelize({
    database: sqlDb,
    username: sqlUser,
    password: sqlPasswd,
    host: sqlHost,
    dialect: 'mssql',
  })

  standardDataStoreTests(sequelize)
})

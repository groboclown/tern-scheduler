import { Options } from 'sequelize'
import {
  standardDataStoreTests
} from './all-datastores'

describe('PostGreSQL compatibility', () => {
  const sqlDb = process.env.POSTGRES_DB
  const sqlUser = process.env.POSTGRES_USERNAME
  const sqlPasswd = process.env.POSTGRES_PASSWORD
  const sqlHost = process.env.POSTGRES_HOST || 'localhost'
  const sqlPort = process.env.POSTGRES_PORT || '5432'
  if (!sqlDb || !sqlUser || !sqlPasswd) {
    describe('no PostGreSQL compatiblity setup', () => {
      it('requires env values POSTGRES_DB and POSTGRES_USERNAME and POSTGRES_PASSWORD', () => {
        // Do nothing.  Here only to mark that the PostGreSQL tests weren't run.
      })
    })
    return
  }

  const sequelize: Options = {
    database: sqlDb,
    username: sqlUser,
    password: sqlPasswd,
    host: sqlHost,
    port: Number(sqlPort),
    dialect: 'postgres',
  }

  standardDataStoreTests(sequelize)
})

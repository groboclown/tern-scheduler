import { Sequelize } from 'sequelize-typescript'
import {
  standardDataStoreTests
} from './all-datastores'

describe('PostGreSQL compatibility', () => {
  const sqlDb = process.env.POSTGRES_DB
  const sqlUser = process.env.POSTGRES_USERNAME
  const sqlPasswd = process.env.POSTGRES_PASSWORD
  if (!sqlDb || !sqlUser || !sqlPasswd) {
    describe('no PostGreSQL compatiblity setup', () => {
      it('requires env values POSTGRES_DB and POSTGRES_USERNAME and POSTGRES_PASSWORD', () => {
        // Do nothing.  Here only to mark that the PostGreSQL tests weren't run.
      })
    })
    return
  }

  const sequelize = new Sequelize({
    database: sqlDb,
    username: sqlUser,
    password: sqlPasswd,
    dialect: 'postgres',
  })

  standardDataStoreTests(sequelize)
})

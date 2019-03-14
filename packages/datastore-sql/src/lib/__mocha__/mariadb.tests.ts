import { Options } from 'sequelize'
import {
  standardDataStoreTests
} from './all-datastores'

describe('MariaDB compatibility', () => {
  const sqlDb = process.env.MARIADB_DB
  const sqlUser = process.env.MARIADB_USERNAME
  const sqlPasswd = process.env.MARIADB_PASSWORD
  const sqlHost = process.env.MARIADB_HOST || 'localhost'
  const sqlPort = process.env.MARIADB_PORT || '5432'
  if (!sqlDb || !sqlUser || !sqlPasswd) {
    describe('no MARIADBQL compatiblity setup', () => {
      it('requires env values MARIADB_DB and MARIADB_USERNAME and MARIADB_PASSWORD', () => {
        // Do nothing.  Here only to mark that the MARIADBQL tests weren't run.
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
    dialect: 'mariadb',
  }

  standardDataStoreTests(sequelize)
})

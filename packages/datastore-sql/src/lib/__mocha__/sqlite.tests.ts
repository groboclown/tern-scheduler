import { Options } from 'sequelize'
import {
  standardDataStoreTests
} from './all-datastores'

describe('SQLite compatibility', () => {
  const useSqlite = process.env.SQLITE
  if (!useSqlite) {
    describe('no sqlite compatiblity setup', () => {
      it('requires env value SQLITE set to a non-blank value.', () => {
        // Do nothing.  Here only to mark that the MySQL tests weren't run.
      })
    })
    return
  }

  const sequelize: Options = {
    // Use in-memory database, not a file.
    dialect: 'sqlite',
  }

  standardDataStoreTests(sequelize)
})

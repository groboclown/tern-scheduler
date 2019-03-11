
const tern = require('@tern-scheduler/core');
const ternSql = require('@tern-scheduler/datastore-sql');
const Sequelize = require('sequelize');


// Determine which datastore provider to use, based on the
// environment variables.

exports.datastore = (() => {
  const dbProviderSettings = {};
  (process.env.TERN_DB || 'db=memory').split(';')
    .forEach(v => {
      let s = v.split('=', 2);
      dbProviderSettings[s[0]] = s[1];
    });

  switch (dbProviderSettings.db) {
    case 'memory':
      return tern.createMemoryDataStore();
    case 'sqlite':
      return ternSql.createSqlDataStore({
        dialect: 'sqlite',
        file: dbProviderSettings.file || ':memory:',
      });
    case 'mysql':
      return ternSql.createSqlDataStore({
        database: dbProviderSettings.name,
        username: dbProviderSettings.user,
        password: dbProviderSettings.password,
        host: dbProviderSettings.host || 'localhost',
        port: Number(dbProviderSettings.port || '3306'),
        dialect: 'mysql',
      });
    case 'postgres':
    case 'postgresql':
      return ternSql.createSqlDataStore({
        database: dbProviderSettings.name,
        username: dbProviderSettings.user,
        password: dbProviderSettings.password,
        host: dbProviderSettings.host || 'localhost',
        port: Number(dbProviderSettings.port || '5432'),
        dialect: 'postgres',
      });
    case 'mssql':
      return ternSql.createSqlDataStore({
        database: dbProviderSettings.name,
        username: dbProviderSettings.user,
        password: dbProviderSettings.password,
        host: dbProviderSettings.host || 'localhost',
        port: Number(dbProviderSettings.port || '1433'),
        dialect: 'mssql',
      });
    case undefined:
    case null:
      throw new Error('Must define the DB provider type with the `TERN_DB` ENV value including "db=(provider)" value');
    default:
      throw new Error(`Unknown db provider "${dbProviderSettings.db}"`);
  }
})();

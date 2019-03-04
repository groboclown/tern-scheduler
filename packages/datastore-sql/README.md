# Tern Scheduler SQL Database Backed DataStore

Uses [`sequelize`](https://github.com/sequelize/sequelize) to connect to a database as the back-end storage mechanism for Tern Scheduler.

# Usage

You need to first create and initialize a `Sequelize` object with the database connection information.  Look over the documentation on that site to understand how.

Then, use that object to create the `datastore` instance:

```(typescript)
import { Sequelize } from 'sequelize';
import { createSqlDataStore } from '@tern-scheduler/datastore-sql';

const sequelize = new Sequelize({
    // Connection information
});

const datastore = createSqlDataStore(sequelize);
```

The `createSqlDataStore` function can also receive an optional logger function argument.  If provided, it takes a SQL value as the first argument, indicating the generated SQL by the `sequelize` command, and an optional second argument which is the time the execution of said SQL statement took to run.  Some commands, such as table creation, do not report the time taken, so the value will be `undefined`.

```(typescript)
const datastore = createSqlDataStore(sequelize, (sql: string, timeMillis?: number) => {
    console.log(`Ran [${sql}] in ${timeMillis} ms`);
});
```

That `datastore` value will be used as the `datastore` parameter when creating the Tern scheduler object.

The basic [tests directory](lib/__mocha__) directory contains test files that show how to connect that database to tern.

# Testing

The tests allow for running against a Microsoft SQL, MySQL, PostGreSQL, or SQLite database.

If you don't have those databases installed locally, then you can use Docker to run a test version of the database.  Details on running with docker are in the [docker-tests](docker-tests/README.md) directory.

## Testing with SQLite

*See the [test connector](lib/__mocha__/sqlite.tests.ts)*

To run the tests with SQLite, you need to have it locally installed.  Then, run the tests with the SQLITE flag set:

```(bash)
$ SQLITE=y npm run test
```

There is no server to setup, or username or password or file location to use.  The environment variable `$SQLITE` just needs to be set to a value for them to run.  So even if you have `SQLITE=no`, it will still run.

## Testing with MySQL

*See the [test connector](lib/__mocha__/mysql.tests.ts)*

You can run tests against a MySQL server as long as you have a database that you have freedom to muck with.  Alternatively, you can run it in a docker container.  In either case, you will need to define the following environment variables to run the tests with MySQL:

* `MYSQL_DB` name of the database to store the tables.
* `MYSQL_USERNAME` username used in authentication.
* `MYSQL_PASSWORD` password of the username used in authentication.  Note that the tests do not allow for blank passwords.
* `MYSQL_HOST` hostname of the MySQL server; defaults to `localhost`
* `MYSQL_PORT` TCP port on which the MySQL receives connections; defaults to `3306`

## Testing with PostGreSQL

*See the [test connector](lib/__mocha__/postgres.tests.ts)*

You need access to a PostGreSQL database server with enough access to perform table create and drop operations.   Alternatively, you can run it in a docker container.  In either case, you will need to define the following environment variables to run the tests against that database server:

* `POSTGRES_DB` database to store the tables.
* `POSTGRES_USERNAME` username for authentication.
* `POSTGRES_PASSWORD` password for authentication.
* `POSTGRES_HOST` hostname of the database server ; defaults to `localhost`
* `POSTGRES_PORT` listening TCP port for the server ; defaults to `5432`


## Testing with Microsoft SQL Server

*See the [test connector](lib/__mocha__/mssql.tests.ts)*

You need access to a SQL Server database server with enough access to perform table create and drop operations.   Alternatively, you can run it in a docker container.  In either case, you will need to define the following environment variables to run the tests against that database server:

* `MSSQL_DB` database to store the tables.
* `MSSQL_USERNAME` username for authentication.
* `MSSQL_PASSWORD` password for authentication.
* `MSSQL_HOST` hostname of the database server ; defaults to `localhost`
* `MSSQL_PORT` listening TCP port for the server ; defaults to `1433`

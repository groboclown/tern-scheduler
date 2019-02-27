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

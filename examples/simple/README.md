# Simple Tern Scheduler Example

This is a stand-alone example that can run by itself.  It doesn't use a web service or any other interface to interact with the database.  It uses a SQL-backed database to store the data, and sets up a static schedule.  You can start multiple instances simultaneously.

## To Run

You'll first need to build the project.  From the root directory:

```bash
$ npm install
$ npm run bootstrap
$ npm run build
```

Then, you need to set the `TERN_DB` environment variable to a custom "connection string".  It is in the form "key1=value;key2=value".  All connections must supply the key `db`, which dictates which database connection type to use.

For SQLite3 databases, use `TERN_DB="db=sqlite"` to indicate that the SQLite db is used with a memory-only database.  To use a specific file, then set it to `TERN_DB="db=sqlite;file=filename"`

For MySQL (`db=mysql`), PostGreSQL (`db=postgres`), and Microsoft SQL Server (`db=mssql`), they all use the following keys:

* `name=(dbname)` the name of the database to connect to.
* `user=(username)` the username to connect to the database.
* `password=(password)` the password for the username.
* `host=(hostname)` the computer name hosting the database; defaults to `localhost`.
* `port=(port)` the TCP/IP port the database listens on; defaults to the database's default port.

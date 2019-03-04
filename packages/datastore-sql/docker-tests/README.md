# About

This folder contains files to run the database instances with the correct configuration so that local tests can run against that server.

The [`docker-compose.yml`](docker-compose.yml) file contains each of these databases, so that they can all be run together, for a single run with all the databases.

## MySQL

Start the service:

```(bash)
$ docker run --name tern-mysql \
    -e MYSQL_USER=tern-user \
    -e MYSQL_PASSWORD=tern-pw \
    -e MYSQL_RANDOM_ROOT_PASSWORD=yes \
    -e MYSQL_DATABASE=tern \
    -p19000:3306 \
    -d mysql:latest
```

Run the tests:

```(bash)
$ MYSQL_DB=tern MYSQL_USERNAME=tern-user MYSQL_PASSWORD=tern-pw MYSQL_PORT=19000 npm run test
```

(the default value for `MYSQL_HOST` is `localhost`)


## PostGreSQL

Start the service:

```(bash)
$ docker run --name tern-postgres \
    -e POSTGRES_USER=tern-user \
    -e POSTGRES_PASSWORD=tern-pw \
    -e POSTGRES_DB=tern \
    -p19001:5432 \
    -d postgres:alpine
```

Run the tests:

```(bash)
$ POSTGRES_DB=tern POSTGRES_USERNAME=tern-user POSTGRES_PASSWORD=tern-pw POSTGRES_PORT=19001 npm run test
```

(the default value for `POSTGRES_HOST` is `localhost`)


## Microsoft SQL Server

In order to run the Microsoft SQL Server, you need to accept the [license agreement](https://go.microsoft.com/fwlink/?linkid=857698)![extern](../../../site/img/extern.svg), and acknowledge this by passing `ACCEPT_EULA=Y` environment variable.

```(bash)
$ docker run --name tern-mssql \
    -e 'ACCEPT_EULA=Y' \
    -e 'SA_PASSWORD=tern-pw-1234' \
    -p19002:1433 \
    -d microsoft/mssql-server-linux:latest
```

Run the tests:

```(bash)
$ MSSQL_DB=master MSSQL_USERNAME=sa MSSQL_PASSWORD=tern-pw-1234 MSSQL_PORT=19002 npm run test
```

(the default value for `MSSQL_HOST` is `localhost`)

Note that with a real Microsoft SQL Server instance, you wouldn't use the `master` database.

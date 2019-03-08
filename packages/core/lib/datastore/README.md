# About the Data Store API

The Data Store part of Tern allows for you to use whatever underlying technology you want, as long as it can provide these mechanisms:

* Available to active service instances.  The running services must be able to contact the data store.  This usually means some kind of network access in order for the services to be fault-tolerant.
* Conditional Atomic Write.  The system must support the ability to write to a record only if certain criteria are true with that record.  This must be done within a transaction, so that there isn't the possibility of actor A reading the store, actor B writing to the store, then actor A writing to the store again based on the original data state.  The set of conditions that must be provided in a single update are string equality for two fields.
* Wait for commit.  The write operations must allow for waiting for consistency in the data store before returning an "okay" value.
* Single table read with conditional retrieval.  The system must support reading from a single "table".

Things like persistence and high availability are left as requirements for the end user, and are not necessary for the scheduler (but are nice to have).

## Custom Implementation of the API

To create a custom provider for the data store API, you need to create a class that implements the [DataStore API](api.ts) class.

All date values will be passed to the API as UTC timezone (regardless of what the JavaScript `Date` object may say), and they must be similarly returned in UTC.

The implementation is free to add whatever indices, primary keys, and other columns to make it work as needed, but the passed-in "primary key" values must be respected and retrieved.


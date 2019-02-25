# About the Data Store API

The Data Store part of Tern allows for you to use whatever underlying technology you want, as long as it can provide these mechanisms:

* Available to active service instances.  The running services must be able to contact the data store.  This usually means some kind of network access in order for the services to be fault-tolerant.
* Conditional Atomic Write.  The system must support the ability to write to a record only if certain criteria are true with that record.  This must be done within a transaction, so that there isn't the possibility of actor A reading the store, actor B writing to the store, then actor A writing to the store again based on the original data state.  The set of conditions that must be provided in a single update are:
    * AND operation - joining multiple conditional blocks together where all of them must evaluate to TRUE.
    * OR operation - joining multiple conditional blocks together where at least one of them must evaluate to TRUE.
    * Date comparison - checking a date stored in the record against an arbitrary date value to see which is earlier.
    * String Equality comparison - checking that an arbitrary string value equals a value stored on the record.
* Wait for commit.  The write operations must allow for waiting for consistency in the data store before returning an "okay" value.
* Single table read with conditional retrieval.  The system must support reading from a single "table".

Things like persistence and high availability are left as requirements for the end user, and are not necessary for the scheduler (but are nice to have).

Attempts have been made to create a static schema for the [data model](../model), to make SQL-based solutions easy.

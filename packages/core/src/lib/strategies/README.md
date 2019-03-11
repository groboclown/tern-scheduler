# About

Framework for registering new strategies to handle different aspects of the system.

## Task Creation Strategies

Task creation strategies allow for creating new ways to create execution times for tasks based on a scheduled job.  These are associated with the scheduled job, and have a custom configuration setting.

This is user-facing, so any registered task creation strategy must have it data storage description be created in the expected format.


## Duplicate Task Strategies

Duplicate task strategies handle what to do when a task for a strategy is already active (pending or running) when the strategy must create a new task.


## Poll Strategies

How to poll for something to happen.

The general approach is for the generated poll strategy to be an array of seconds to wait between polls.  After each poll, the wait time moves through the list.  This can help prevent multiple services from performing the same operations at the same time, causing unnecessary contention.


## Retry Strategy

How to retry an operation after it fails.  Right now, this is just using the poll strategies, running through the array once then stopping retry attempts.


## Lease Time Strategy

Strategy for creating the duration of a lease.

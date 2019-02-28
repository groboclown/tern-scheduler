# Tern - That Flocking Scheduler

[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lernajs.io/)

Tern aims to be a cluster-friendly scheduling service, able to provide reliability and high availability in the scheduling service.

It can run as an add-in library, a stand-alone application, or as a REST API application running with Express.

It's built to be flexible to conform to your needs.  Any time the code encounters a situation where several things could be done, the system lets you decide what it should do (while providing some great out-of-the-box default behaviors).

Tern is licensed under the [MIT License](LICENSE)


## Why Use Tern?

Tern is still under development, but it is being developed with these goals:

* **Cluster safe.**  Multiple instances can run together without causing missed job execution or double executions.  Any situation that puts the system in an indeterminate state should provide hooks to the developer to tell the system how to handle it.
* **Separation of job execution and scheduling.**  The base library uses a simple API to add in job executors, but the onus is on you to handle job failure retries and monitoring.  You must provide code to either inform the scheduler when a job completes (or fails without further retries), or write a provider that can answer that question.
* **Flexible schedule declarations.**  The service handles different request types, taking into account requested origin time zones.  You can use one of the built in strategies, or make your own.
* **Configurable Technology.**  Want to use a specific back-end data store?  Want to use a messaging system?  Need a specific REST API provider?  Tern is developed with flexibility in mind.  It provides some common back-ends, with clear instructions on what you need to do to add your own.
* **Job retry.**  The scheduler allows for a job execution framework to retry running a job at some future time.
* **Time Zone Awareness.**  Requests need to include a timezone parameter, and the server needs to be aware of the differences between the *requested* time zone and the *server* time zone.
* **Typescript**  Built with type safety and is out-of-the-box ready for your typescript application.

The following are anti-goals for the project:

* **Workflow.**  Tern does not manage the chaining of job execution.  You might be tempted to use the job conflict resolution to do this, but don't.  There are other tools that can be used for this that handle all those fiddly bits that Tern doesn't.
* **Job execution.** For the simplest of cases, you can run the job directly in the Tern service.  However, for the most part, you will want to delegate to another tool that can better handle clustered job execution.
* **Job conflict.** If two jobs cannot run simultaneously, then it's up to the job execution framework to understand that conflict and report that the job requires a retry.


## Using Tern

Tern Scheduler is primarily a scheduling library ("tern-core") along with additional libraries to help you tie it together into a usable tool.  This means, as an end user, you'll need to make some decisions about how you want to connect it all up.

All uses of the scheduling API start out the same. Create a data store implementation and setup the configuration.

```(typescript)
import { TernConfiguration, PollingCallback } from '@tern-scheduler/core';

const datastore = ;
const pollingCallback = new PollingCallback();
const config = new TernConfiguration({
  // Your data store, based on your specific environment.
  store: myOwnDataStoreCreationMechanism(),

  // Allows for different ways to poll for different actions.
  generatePollWaitTimesStrategy: createMyGeneratePollWaitTimesStrategy(),

  // Defines how long to wait to retry if a lease is owned by another
  // process, and also how many times to retry.
  retryLeaseTimeStrategy: createMyLeaseRetryTimeInSecondsStrategy(),

  // You can provide the time to allow the combined effort for
  // the datastore access + the job execution framework to fire a job.
  // Default is 300 seconds (5 minutes).
  leaseTimeSeconds: 10

  // The background polling activity monitor and runner.
  pollingCallback
});

// When you desire background polling tasks to stop, this call will cause all
// the polling methods to drain out before quitting.
pollingCallback.stopAndWait()
  .then(() => {
    console.log(`All background activities are complete.`);
  }
  .catch(() => {
    console.log(`Timed out waiting for activities to complete.`);
  });
```

`pollingCallback` can be used to monitor the polling and retry activities, and can be used to stop them safely.  The `config` object stores all the shared configuration information used by the clients and scheduler service.

If you really need to, there are additional default strategies you can override.  Those are described below.

### Client

The API client is used to monitor schedule and task activity, and to manage scheduled jobs.  It returns results using the standard Promise class.

```(typescript)
import { TernClient } from '@tern-scheduler/core';

const client = new TernClient(config);
client.createScheduledJob(scheduledJobDefinition)
  .then(schedule => {
    console.log(`Created schedule ${schedule.displayName`);
    return client.getActiveScheduledJobs()
  })
  .then(schedulePage => {
    schedulePage.page.forEach(schedule => {
      console.log(`${schedule.displayName} is running.`);
    });
  })
  .catch(e => {
    console.log(e);
  });
```

### Scheduler Service

```(typescript)
import { TernScheduler } from '@tern-scheduler/core'

const scheduler = new TernScheduler(config,
    // You will need to provide a way to connect your job
    // execution framework with Tern.  See below for more details.
    createMyJobExecutionManager());

// Add more strategies to meet your schedule and task needs
scheduler.strategies.taskCreationStrategyRegistry
  .register('custom', myCustomStrategy);
```



### What Are We Talking About

Tern uses these terms to describe different aspects of the system:
* *[data store](#choosing-a-data-store)* - The mechanism for providing persistent data storage.
* *job* - An activity that the external job execution framework runs.
* *job execution framework* - An external system that handles running and monitoring discrete units of work, called "jobs".  If the job framework chains several actions together, then that whole chain of actions are considered a single "job" by Tern.
* *scheduled job* - A schedule for running a job, either once or on a reoccurring pattern.
* *task* - A marker for when a specific job should run.  Tasks are "peeled" off of a scheduled job, as though the scheduled job is a daily calendar of when the next thing happens.
* *strategy* - Part of the strategy programming pattern; it is a named way to perform a specific kind of action, or to answer a specific question.  Strategies are stored in a *strategy registration* object, to allow several approaches to the same problem.  Some of these are useful only for testing, while others can add flexibility to the system.
* *node* - A single running instance of the scheduler.  Note that all nodes *should* be homogeneous (configured the same).  You don't have to, but to maintain sanity it's recommended that you do.


### Choosing a Data Store

Tern was designed to allow for different data storage technologies, depending upon your requirements.  There are some basic, minimal requirements that the technology must provide in order for it to work.  The biggest one is "atomic, conditional commit" - the store needs to reliably provide some mechanism to set some values on a record if and only if some preconditions on that record are met, and it must do so safely if a different actor tries to perform the same behavior on the same record from anywhere on the network.  The [data store documentation](core/src/datastore/README.md) details the requirements and implementation guidelines.

If you are running with one of the out-of-the-box data stores, you just need to `require` the module and instantiate it according to its instructions (such as providing connection information).  Right now, those modules are:

* `require('tern-scheduler/core').createMemoryDataStore()` - an in-memory data storage which is only useful for local testing.  It cannot work with multiple instances of the service.


### Choosing a Job Executor

Tern provides "hooks" for you to tell it a relationship between a job executor name and the code that runs that job.  It's open-ended enough to allow running in-process, or some cloud-based task execution framework.

Job executors fall into two categories - message based or polling.  Message based executors rely on the execution environment to push state-change notifications.  Polling executors require the client to make requests for the current state.

All job executors implement the [JobExecutionManager](core/src/executor) interface.  Polling job executors will need to set up the poll mechanisms on the messaging connection, while message based ones will need to wire their message approaches to the message event emitter.


### Choosing a Messaging Pipeline

Tern can use a message pipeline to make its execution more efficient, but it's not necessary.  However, inside the service, all major events that are triggered by the job execution tool or polling or some other mechanism are passed through a standard Node event emitter object.


### Choosing Strategies

Many aspects of the scheduler are allowed to be configured through a strategy pattern.

#### Task Creation

The task creation strategy allows for configurable behavior for creating a new task with a specific trigger time.  Tasks can be created at different points in the scheduled job lifecycle.

* **At scheduled job creation.**  When the scheduled job is first created, a fresh, initial task must be created.
* **When the last task completes.**  When a task finishes its execution, either with a failure or success, a new task can be created.  If the task needed to retry its operation, then only the final non-retried task execution attempts to create the next task.
* **When the last task first starts running.**  When a task is slated to start running for the first time, without retries,

#### Duplicate Task Behavior

There are times when a task can take such a long time to run, or needs to retry running enough, that another task becomes available to start running.  The two things that the strategy can determine are whether it should let the job execution framework attempt to run the second task at the same time (`run`), or to skip running the new task (`skip`).

This is configurable per scheduled job.

#### Lease ID Creation

The library must create globally unique IDs per attempt to obtain a lease on a strategy job.  The default behavior is to use a UUID v5 algorithm with the `HOSTNAME` environment variable as the main discriminator.

#### Lease Time

The time to allow for each lease operation to run.  If the operation with the lease takes longer than this, then the scheduled job is considered "expired" and must be repaired.  The lease time helps mitigate problems with [partial failure](https://en.wikipedia.org/wiki/Fault_tolerance)![extern](./site/img/extern.svg)

#### Poll Wait Time

The system can be optionally setup to poll for state changes, rather than use a messaging system to announce when events occur.  The rate at which the polling happens can be configured.

There are potential issues with polling mechanisms.  The biggest is resource contention if all the nodes end up polling at the same time.  The library can mitigate this by using a list of poll times, so that each poll period can be different than the one before it.

Note that the library uses events to handle these requests, but the event emitters can come from polling.

#### Primary Key Creation

Tern is written to allow for different kinds of data stores.  To that end, it can't rely upon the underlying data store to generate guaranteed unique identifiers across nodes.

By default, this uses a UUID v5 algorithm with the `HOSTNAME` environment variable as the main discriminator.

#### Current Time

Yes, you can change how the library discovers the current time.  By default, this uses the built-in JavaScript `new Date()` functionality, but in cases such as unit tests, you can change it out.  All implementations must return the time in UTC.

### Handling Errors

All errors encountered in the schedule are passed to the [event message emitter](core/src/messaging/README.md).  By default, errors are reported to standard error.  You can add a new handler by listening to the `generalError` event on the message emitter.

## Under the Covers

Tern breaks up the problem of scheduling job executions into these more basic problems:

* **Scheduled Job Management.**  The user defines scheduled jobs to execute at some time in the future (possibly the immediate future).  These jobs may run on a repeated pattern.  The system needs a way to manage these scheduled jobs - adding, creating, and updating them.
* **Next Schedule Execution Prediction.**  The *schedule strategy* associated with the scheduled job is in charge of "peeling off" the next job execution time from the scheduled job.  These are put into a queue for future execution.
* **Job Execution State Management.** The queued *tasks* will eventually hit their "execution time", at which point the system must begin the state management for running the registered job execution framework.

### Scheduled Job and Task Execution State

In order for the system to handle failure conditions, the executing jobs are put into various states.  Understanding these states can help you fix indeterminate state processing, or to update the software.

The server that handled the state change creates a message that indicates the state change.  The messages are not necessary for the operation of the service, but are there for the benefit of system architects that want to integrate the service with their solution.

The implementation uses a variation on the [two-phase commit protocol](https://en.wikipedia.org/wiki/Two-phase_commit_protocol)![extern](./site/img/extern.svg) with lease expiration to allow for recovering from failed nodes.  Additionally, attempts to obtain the lock have retry mechanisms with an eventual failure.  Locks are made on the scheduled job to perform operations on the scheduled job itself or on its child task objects (with a few rare and well considered exceptions).

1. Commit request phase
  * In this phase, a process (a thread of behavior within a node) makes an atomic conditional write operation to the data store to allocate the lock.  If the lock is already allocated, the request fails.  Note that this takes advantage of whatever locking mechanism the underlying data store has.
  * Failures can be retried with different timeouts (that's one of the strategies).  After sufficient number of retries, the lock acquisition fails.
  * Success puts the scheduled job in the "updating" state, which is the "lock obtained" phase.
1. Commit phase
  * The process, which now has a lease on the lock, performs an update to the data objects.  These operations should be very tightly controlled and "quick".  As the library is written now, this phase includes only data store manipulations plus the one call-out to the job execution service.
  * Any unexpected failures here put the scheduled job in an "update-error" state, which means that the scheduled job and its tasks must be repaired before it can be unlocked.
1. Commit complete phase
  * Once the in-lock actions complete, the process releases the lock.
  * This might fail due to something else "stealing" the lock if the lease expired.
1. Lock repair phase
  * If a scheduled job is in the "update-error" state, then its state is indeterminate.
  * If the lock has expired, then its state should be determined through the task state.
  * If the software determines that it wasn't due to a Tern coding error, then the state should be repaired based on the states of its running tasks.


## Implementation TO-DOs

### Delete and Disable Scheduled Job

Right now, the scheduled job lifecycle goes:
1. Create scheduled job, which implicitly creates a task.
1. Tasks have their lifecycle.
1. The scheduled job is disabled.
1. The scheduled job is deleted.

This, however, puts the tasks in a weird position.

Right now, tasks will only perform state change when the owning scheduled job is active, because leases can only be made on active scheduled jobs, and state change on a task can only happen with a leased parent scheduled job.

This means that if you disable a scheduled job, the pending tasks will not fire, and the actively running tasks will not be able to set their completion state.

However, disabling scheduled jobs is a one-way path; it's done before a delete on the scheduled job can happen.  So there might be exceptional cases done for task completion when the scheduled job is disabled.  However, retrying a failed task for a scheduled job *should* be done, but may be tricky in terms of state management.  Because these updates would be done outside a lease, there's a very real opportunity for duplicate actions to happen.

Additionally, deleting a scheduled job means the tasks should be deleted, too.  Currently, deleting a scheduled job only requires that the scheduled job has the "disabled" state.


# Tern - That Flocking Scheduler

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

The following are anti-goals for the project:

* **Workflow.**  Tern does not manage the chaining of job execution.  You might be tempted to use the job conflict resolution to do this, but don't.  There are other tools that can be used for this that handle all those fiddly bits that Tern doesn't.
* **Job execution.** For the simplest of cases, you can run the job directly in the Tern service.  However, for the most part, you will want to delegate to another tool that can better handle clustered job execution.
* **Job conflict.** If two jobs cannot run simultaneously, then it's up to the job execution framework to understand that conflict and report that the job requires a retry.


## Using Tern

Tern Scheduler is primarily a scheduling library ("tern-core") along with additional libraries to help you tie it together into a usable tool.  This means, as an end user, you'll need to make some decisions about how you want to connect it all up.


### What Are We Talking About

Tern uses these terms to describe different aspects of the system:
* *[data store](#choosing-a-data-store)* - The mechanism for providing persistent data storage.
* *job* - An activity that the external job execution framework runs.
* *job execution framework* - An external system that handles running and monitoring discrete units of work, called "jobs".  If the job framework chains several actions together, then that whole chain of actions are considered a single "job" by Tern.
* *scheduled job* - A schedule for running a job, either once or on a reoccurring pattern.
* *task* - A marker for when a specific job should run.
* *strategy* - Part of the strategy programming pattern; it is a named way to perform a specific kind of action, or to answer a specific question.  Strategies are stored in a *strategy registration* object, to allow several approaches to the same problem.


### Choosing a Data Store

Tern was designed to allow for different data storage technologies, depending upon your requirements.  There are some basic, minimal requirements that the technology must provide in order for it to work.  The biggest one is "atomic, conditional commit" - the store needs to reliably provide some mechanism to set some values on a record if and only if some preconditions on that record are met, and it must do so safely if a different actor tries to perform the same behavior on the same record from anywhere on the network.  The [data store documentation](scheduler/src/datastore/README.md) details the requirements and implementation guidelines.

If you are running with one of the out-of-the-box data stores, you just need to `require` the module and instantiate it according to its instructions (such as providing connection information).  Right now, those modules are:

* `tern-scheduler~lib/datastore/memory` - an in-memory data storage which is only useful for local testing.  It cannot work with multiple instances of the service.


### Choosing a Job Executor

Tern provides "hooks" for you to tell it a relationship between a job executor name and the code that runs that job.  It's open-ended enough to allow running in-process, or some cloud-based task execution framework.

Job executors fall into two categories - message based or polling.  Message based executors rely on the execution environment to push state-change notifications.  Polling executors require the client to make requests for the current state.


### Choosing a Messaging Pipeline

Tern can use a message pipeline to make its execution more efficient, but it's not necessary.  However, inside the service, all major events that are triggered by the job execution tool or polling or some other mechanism are passed through a standard Node event emitter object.


### Choosing a Strategy

Many aspects of the scheduler are allowed to be configured through a strategy pattern.

#### Task Creation

(TODO)

#### Primary Key Creation

(TODO)

#### Duplicate Task Behavior

(TODO)

#### Lease ID Creation

(TODO)

#### Lease Time

(TODO)

#### Poll Wait Time

(TODO)


### Handling Errors

All errors encountered in the schedule are passed to the [event message emitter](scheduler/src/messaging/README.md).  By default, errors are reported to standard error.  You can add a new handler by listening to the `generalError` event on the message emitter.


## Under the Covers

Tern breaks up the problem of scheduling job executions into these more basic problems:

* **Scheduled Job Management.**  The user defines scheduled jobs to execute at some time in the future (possibly the immediate future).  These jobs may run on a repeated pattern.  The system needs a way to manage these scheduled jobs - adding, creating, and updating them.
* **Next Schedule Execution Prediction.**  The *schedule strategy* associated with the scheduled job is in charge of "peeling off" the next job execution time from the scheduled job.  These are put into a queue for future execution.
* **Job Execution State Management.** The queued *tasks* will eventually hit their "execution time", at which point the system must begin the state management for running the registered job execution framework.

### Job Execution State

In order for the system to handle failure conditions, the executing jobs are put into various states.  Understanding these states can help you fix indeterminate state processing, or to update the software.

The server that handled the state change creates a message that indicates the state change.  The messages are not necessary for the operation of the service, but are there for the benefit of system architects that want to integrate the service with their solution.

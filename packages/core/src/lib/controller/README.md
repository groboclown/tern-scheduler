# About

Handles the standard operations on the model objects against a datastore.

These files are the heart of the scheduler.  They handle the leasing of scheduled jobs and task state transitions.

## Locking and Leasing

Due to the primary goal of writing a scheduler that is capable of running multiple instances of itself against the same data store, there needs to be a way to atomically tell all the other instances when one requires exclusive access to a scheduled job.  In this context, any write operation requires exclusive access; read operations should be safe to run in any context.  However, once a scheduled job enters exclusive access mode, its state must be re-read from the data store to ensure its accuracy.

Tern uses a leased lock through the data store to implement this exclusive access mode.  Tern depends on the underlying data store to provide the atomic updates.  It uses a lease mechanism to prevent a partial failure scenario, such as if one service were to stop execution while it owned a lock.  This also means that Tern depends upon all the services to run on computers with synchronized clocks.

Tern uses the scheduled job as the lock owner, which implies that any modification to a task requires first locking its owner scheduled job.

Expired leases are transitioned into "repair" states, so that Tern can attempt to recover the execution from where it may have left off after a failure.

When a scheduled job is locked, its lock state indicates the state transition being performed.  This helps aid the repair operations to better understand the state at the time of failure.  When the lock is released, this state must also be cleared.


## States and Transitions

The state setup is non-trivial.  This is compounded by Tern not requiring data stores to provide transactions across multiple requests.

These are the primary transitions that happen, each of which must deal with multiple starting states and error conditions.


### Create New Scheduled Job

This state transition can be run from anywhere, not just a Tern service.

When a scheduled job is created, it must be created in a locked state, so that no service can attempt to operate on it until it completes initialization.

The scheduled job creates the first task, but must not run it.

When the task is created and the scheduled job completes its initialization in the database, it must be unlocked.

An alternative construction would create the task _first_, then the scheduled job, as this would mean no update is required.  However, this can lead to a state where the data store contains dangling tasks without owning scheduled jobs.

**Repairs:** If the repair service finds a scheduled job in the 'creating' state, 

**State:** Appears to be working right.  No anomolous behavior observed.  Requires additional unit tests, though.

### Start Task Execution

When a service discovers a task that needs execution, it begins the Start Task Execution transition.  This transition expects to obtain a lock on the scheduled job, mark the task as starting, call to the job execution framework to start the execution, then mark the task's state according to the returned value from the job execution framework.  This may optionally initiate a retry, and possibly trigger the creation of a new task.

All the operations for this transition must be done with a locked scheduled job.  If the lock cannot be obtained after a set number of retries, then that indicates that some other service is performing a similar operation on the scheduled job.  Because not performing this operation does not affect the need-to-run state of a task, it is safe to not report the lock-not-obtained error.


### Task Execution Finished

### Disable Scheduled Job

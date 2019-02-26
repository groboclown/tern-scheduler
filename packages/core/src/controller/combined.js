"use strict";
exports.__esModule = true;
var schedule_1 = require("./schedule");
var model_1 = require("../model");
var strategies_1 = require("../strategies");
var types_1 = require("../executor/types");
var errors_1 = require("../errors");
var logging_1 = require("../logging");
var controller_errors_1 = require("../errors/controller-errors");
var api_1 = require("../strategies/task-creation/api");
var schedule_2 = require("../model/schedule");
/**
 * How many tasks to query for running state to see if there's a duplicate
 * running task, before starting a new one.
 *
 * TODO should this be configurable?  Should never allow capturing all of them,
 * in case of weird issues in the service.
 */
var DUPLICATE_RUNNING_TASK_LIMIT = 100;
// Functions that still perform at the controller level, but need to coordinate the operation
// between the different model parts.
/**
 * Creates the schedule and the first task.
 */
function createScheduledJob(store, schedule, leaseBehavior, now, createPrimaryKeyStrat, taskCreationReg, messaging) {
    return schedule_1.createScheduledJobAlone(store, schedule, now, leaseBehavior, createPrimaryKeyStrat, messaging, function (sched) {
        var strat = taskCreationReg.get(schedule.taskCreationStrategy);
        var taskRunDate = strat.createFromNewSchedule(now, sched);
        // A task item must always be created when a scheduled job is
        // created.
        var task = {
            pk: createPrimaryKeyStrat(),
            schedule: sched.pk,
            createdOn: now,
            state: model_1.TASK_STATE_PENDING,
            executeAt: taskRunDate,
            executionJobId: null,
            retryIndex: 0,
            completedInfo: null,
            executionQueued: null,
            executionStarted: null,
            executionFinished: null,
            nextTimeoutCheck: null
        };
        return store.addTask(task)
            .then(function () {
            messaging.emit('taskCreated', task);
            return { value: sched };
        });
    });
}
exports.createScheduledJob = createScheduledJob;
/**
 * Called when the schedule's execution time is reached.  This will handle
 * leasing the schedule, duplicate detection & handling,
 */
function createTaskForSchedule(store, schedule, now, lease, taskRunDate, createPrimaryKeyStrat, retryIndex, duplicateTaskReg, messaging) {
    // FIXME this method needs to be removed.  Instead, this checking must be done inside the other
    // schedule lifecycle checks.  The task creation is done when a task finishes with no more
    // retries, a task starts running, or a scheduled job is created.
    var task = {
        pk: createPrimaryKeyStrat(),
        schedule: schedule.pk,
        createdOn: now,
        state: model_1.TASK_STATE_PENDING,
        executeAt: taskRunDate,
        executionJobId: null,
        retryIndex: retryIndex,
        completedInfo: null,
        executionQueued: null,
        executionStarted: null,
        executionFinished: null,
        nextTimeoutCheck: null
    };
    return schedule_1.runUpdateInLease(store, schedule.pk, now, lease, messaging, function (job, leaseId) {
        // Check if there's another task already in queued or running state
        // for this schedule.  If so, run duplicate strategy logic.
        return store
            .getActiveTasksForScheduledJob(job, DUPLICATE_RUNNING_TASK_LIMIT)
            .then(function (activeTasks) {
            if (activeTasks.length > 0) {
                var strat = duplicateTaskReg.get(job.duplicateStrategy)(job, activeTasks, task);
                if (strat === strategies_1.DUPLICATE_TASK_SKIP_NEW) {
                    logging_1.logInfo('createTaskForSchedule', "Skipping creating new task for schedule " + schedule.pk);
                    return Promise.resolve({
                        value: null
                    });
                }
            }
            // Otherwise, create the task
            return store.addTask(task)
                .then(function () {
                messaging.emit('taskCreated', task);
                return {
                    value: null
                };
            });
        });
    })
        // Ensure we return no value
        .then(function () { });
}
exports.createTaskForSchedule = createTaskForSchedule;
/**
 * Starting at the point where a task is ready to run, this tries to
 * obtain a lease on the owning strategy then put the task into the
 * right state.  It also kicks off the job.
 */
function startTask(store, task, leaseBehavior, now, startJob, taskCreationReg, currentTimeUTC, createPrimaryKeyStrat, 
// TODO include timeouts for queue and run times?  Should those be part of the job framework (thus the messaging)?
messaging) {
    return schedule_1.runUpdateInLease(store, task.schedule, now, leaseBehavior, messaging, function (sched) {
        return store
            // FIXME should the queue call include the set long time check date?
            .markTaskQueued(task, now)
            .then(function () {
            // THe only external system we're allowed to call while we have a
            // scheduled job lease.
            return startJob(task.pk, sched.jobName, sched.jobContext)["catch"](function (e) {
                // request to start the job failed.  This is different than the
                // job just failing; this means the job framework just couldn't
                // perform its actions.
                return store
                    .markTaskStartFailed(task, currentTimeUTC(), String(e))
                    .then(function () { return Promise.reject(e); });
            });
        })
            .then(function (execId) {
            return store
                .markTaskStarted(task, currentTimeUTC(), execId)
                .then(function () { return execId; });
        })
            .then(function (execId) {
            messaging.emit('taskRunning', task, execId);
        })
            .then(function () {
            // Check the job if a new task should be created.
            var taskCreationStrategy = taskCreationReg.get(sched.taskCreationStrategy);
            if (api_1.isTaskCreationStrategyAfterStart(taskCreationStrategy)) {
                var taskRunDate = taskCreationStrategy.createAfterTaskStarts(now, sched);
                if (api_1.isTaskCreationDisable(taskRunDate)) {
                    return Promise.resolve({ value: null, state: schedule_2.SCHEDULE_STATE_DISABLED });
                }
                var task_1 = {
                    pk: createPrimaryKeyStrat(),
                    schedule: sched.pk,
                    createdOn: now,
                    state: model_1.TASK_STATE_PENDING,
                    executeAt: taskRunDate.runAt,
                    executionJobId: null,
                    retryIndex: 0,
                    completedInfo: null,
                    executionQueued: null,
                    executionStarted: null,
                    executionFinished: null,
                    nextTimeoutCheck: null
                };
                return store.addTask(task_1)
                    .then(function () {
                    messaging.emit('taskCreated', task_1);
                    return { value: null };
                });
            }
            // Nothing to run
            return { value: null };
        });
    })
        // Make sure we return void
        .then(function () { });
}
exports.startTask = startTask;
/**
 * Handles task completion when the job framework reports completion.  Includes retry
 * behavior if the job failed.
 *
 * @param store
 * @param execJobId
 * @param result
 * @param now
 * @param messaging
 */
function taskFinished(store, execJobId, result, now, lease, createPrimaryKeyStrat, retryReg, taskCreationReg, duplicateTaskReg, messaging) {
    if (types_1.isJobExecutionStateRunning(result)) {
        throw new errors_1.TernError("invalid job execution state " + JSON.stringify(result));
    }
    return store
        .getTaskByExecutionJobId(execJobId)
        .then(function (task) {
        if (!task) {
            throw new controller_errors_1.TaskNotFoundError(execJobId);
        }
        return schedule_1.runUpdateInLease(store, task.schedule, now, lease, messaging, function (sched, leaseId) {
            if (types_1.isJobExecutionStateFailed(result)) {
                return store
                    .markTaskFailed(task, now, model_1.TASK_STATE_STARTED, model_1.TASK_STATE_COMPLETE_ERROR, result.result)
                    .then(function () {
                    // Handle retry
                    var retryInSeconds = retryReg.get(sched.retryStrategy)(sched, task, result.result);
                    if (retryInSeconds === null) {
                        // No retry.  May need to queue up another task.
                        var taskCreationStrategy = taskCreationReg.get(sched.taskCreationStrategy);
                        if (api_1.isTaskCreationStrategyAfterFinish(taskCreationStrategy)) {
                            var taskRunDate = taskCreationStrategy.createAfterTaskFinishes(now, sched);
                            if (api_1.isTaskCreationDisable(taskRunDate)) {
                                return Promise.resolve({ value: null, state: schedule_2.SCHEDULE_STATE_DISABLED });
                            }
                            var newTask_1 = {
                                pk: createPrimaryKeyStrat(),
                                schedule: sched.pk,
                                createdOn: now,
                                state: model_1.TASK_STATE_PENDING,
                                executeAt: taskRunDate.runAt,
                                executionJobId: null,
                                retryIndex: 0,
                                completedInfo: null,
                                executionQueued: null,
                                executionStarted: null,
                                executionFinished: null,
                                nextTimeoutCheck: null
                            };
                            return store.addTask(newTask_1)
                                .then(function () {
                                // A new task was created, and the old task completed.
                                messaging.emit('taskCreated', newTask_1);
                                messaging.emit('taskFinished', task);
                                return { value: null };
                            });
                        }
                        // Nothing to run after task finished, but the task did finish.
                        messaging.emit('taskFinished', task);
                        return Promise.resolve({ value: null });
                    }
                    // Queue a retry task
                    // Retry time is based on when the task was discovered to be failed,
                    // which is the "now" time.
                    var retryTime = new Date(now.valueOf());
                    retryTime.setSeconds(retryTime.getSeconds() + retryInSeconds);
                    // Check if there's another task already in queued or running state
                    // for this schedule.  If so, run duplicate strategy logic.
                    return store
                        .getActiveTasksForScheduledJob(sched, DUPLICATE_RUNNING_TASK_LIMIT)
                        .then(function (activeTasks) {
                        if (activeTasks.length > 0) {
                            var strat = duplicateTaskReg.get(sched.duplicateStrategy)(sched, activeTasks, task);
                            if (strat === strategies_1.DUPLICATE_TASK_SKIP_NEW) {
                                logging_1.logInfo('createTaskForSchedule', "Skipping creating new task on retry for schedule " + sched.pk);
                                // In this case, retry is not triggered.  So, we complete the task.
                                messaging.emit('taskFinished', task);
                                return Promise.resolve({ value: null });
                            }
                            // else the duplicate running tasks don't inhibit retrying.
                        }
                        // else, no active tasks, so no conflict.
                        var newTask = {
                            pk: createPrimaryKeyStrat(),
                            schedule: sched.pk,
                            createdOn: now,
                            state: model_1.TASK_STATE_PENDING,
                            executeAt: retryTime,
                            executionJobId: null,
                            retryIndex: 0,
                            completedInfo: null,
                            executionQueued: null,
                            executionStarted: null,
                            executionFinished: null,
                            nextTimeoutCheck: null
                        };
                        return store.addTask(newTask)
                            .then(function () {
                            // A new task was created, and the old task completed.
                            messaging.emit('taskCreated', newTask);
                            messaging.emit('taskFinished', task);
                            return { value: null };
                        });
                    });
                });
            }
            else if (types_1.isJobExecutionStateCompleted(result)) {
                return store
                    .markTaskCompleted(task, now, result.result)
                    .then(function () {
                    messaging.emit('taskFinished', task);
                    return { value: null };
                });
            }
            else {
                return Promise.reject(new errors_1.TernError("invalid job execution state " + JSON.stringify(result)));
            }
        });
    })
        // make sure we return void
        .then(function () { });
}
exports.taskFinished = taskFinished;
/**
 * Get the lease and disable the scheduled job.
 *
 * @param store
 * @param schedule
 * @param now
 * @param leaseBehavior
 * @param messaging
 */
function disableSchedule(store, schedule, now, leaseBehavior, messaging) {
    return schedule_1.runUpdateInLease(store, schedule.pk, now, leaseBehavior, messaging, function (sched, leaseId) {
        return { value: null, state: schedule_2.SCHEDULE_STATE_DISABLED };
    })
        // Ensure we return void
        .then(function () { });
}
exports.disableSchedule = disableSchedule;

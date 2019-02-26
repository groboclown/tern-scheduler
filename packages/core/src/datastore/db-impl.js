"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var db_api_1 = require("./db-api");
var model_1 = require("../model");
var schedule_1 = require("../model/schedule");
var task_1 = require("../model/task");
var errors_1 = require("../errors");
var controller_errors_1 = require("../errors/controller-errors");
function updateDate(date, increaseSeconds) {
    var ret = new Date(date.valueOf());
    ret.setSeconds(ret.getSeconds() + increaseSeconds);
    return ret;
}
function parsePageKey(pageKey) {
    var startIndexMaybe = Number(pageKey || '0');
    return startIndexMaybe === NaN ? 0 : startIndexMaybe;
}
function pageResults(rows, startIndex, limit) {
    if (rows.length > limit) {
        rows.slice(1);
        return {
            nextPageKey: (startIndex + limit).toString(),
            estimatedCount: startIndex + rows.length,
            pageSize: limit,
            page: rows
        };
    }
    return {
        nextPageKey: null,
        estimatedCount: startIndex + rows.length,
        pageSize: limit,
        page: rows
    };
}
var DatabaseDataStore = /** @class */ (function () {
    function DatabaseDataStore(db) {
        this.db = db;
    }
    DatabaseDataStore.prototype.updateSchema = function () {
        return this.db.updateSchema();
    };
    // ------------------------------------------------------------------------
    DatabaseDataStore.prototype.addScheduledJobModel = function (model, leaseId, now, leaseTimeSeconds) {
        return this.db.create(schedule_1.SCHEDULE_MODEL_NAME, __assign({}, model, { leaseOwner: leaseId, leaseExpires: updateDate(now, leaseTimeSeconds) }));
    };
    DatabaseDataStore.prototype.getJob = function (pk) {
        return this.db
            .find(schedule_1.SCHEDULE_MODEL_NAME, 0, 1, new db_api_1.EqualsConditional(model_1.MODEL_PRIMARY_KEY, pk))
            .then(function (rows) {
            if (rows.length > 0) {
                return rows[0];
            }
            return null;
        });
    };
    DatabaseDataStore.prototype.pollLeaseExpiredScheduledJobs = function (now, limit) {
        return this.db.find(schedule_1.SCHEDULE_MODEL_NAME, 0, limit, new db_api_1.BeforeDateConditional('leaseExpires', now));
    };
    DatabaseDataStore.prototype.getActiveScheduledJobs = function (pageKey, limit) {
        var startIndex = parsePageKey(pageKey);
        return this.db
            // Stored as a ScheduledJobDataModel, but that's a subclass, so it will conform.
            .find(schedule_1.SCHEDULE_MODEL_NAME, startIndex, limit + 1, new db_api_1.OneOfConditional('state', [schedule_1.SCHEDULE_STATE_ACTIVE, schedule_1.SCHEDULE_STATE_REPAIR, schedule_1.SCHEDULE_STATE_UPDATING]))
            .then(function (rows) { return pageResults(rows, startIndex, limit); });
    };
    DatabaseDataStore.prototype.getDisabledScheduledJobs = function (pageKey, limit) {
        var startIndex = parsePageKey(pageKey);
        return this.db
            // Stored as a ScheduledJobDataModel, but that's a subclass, so it will conform.
            .find(schedule_1.SCHEDULE_MODEL_NAME, startIndex, limit + 1, new db_api_1.EqualsConditional('state', schedule_1.SCHEDULE_STATE_DISABLED))
            .then(function (rows) { return pageResults(rows, startIndex, limit); });
    };
    DatabaseDataStore.prototype.disableScheduledJob = function (job, leaseId) {
        var _this = this;
        return this.db
            .conditionalUpdate(schedule_1.SCHEDULE_MODEL_NAME, job.pk, {
            state: schedule_1.SCHEDULE_STATE_ACTIVE
        }, new db_api_1.OrConditional([
            new db_api_1.EqualsConditional('state', schedule_1.SCHEDULE_STATE_ACTIVE),
            new db_api_1.EqualsConditional('leaseOwner', leaseId),
        ]))
            .then(function (updateCount) {
            if (updateCount > 0) {
                return Promise.resolve(true);
            }
            // Failure triggers can cause the query to not look right if someone steals
            // the state between the initial conditional update and this query.
            return _this.db
                .find(schedule_1.SCHEDULE_MODEL_NAME, 0, 1, new db_api_1.EqualsConditional(model_1.MODEL_PRIMARY_KEY, job.pk))
                .then(function (jobs) {
                if (jobs.length > 0) {
                    if (jobs[0].state === schedule_1.SCHEDULE_STATE_DISABLED) {
                        return Promise.resolve(false);
                    }
                    return Promise.reject(new errors_1.LeaseNotOwnedError(leaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires));
                }
                else {
                    return Promise.reject(new errors_1.ScheduledJobNotFoundError(job.pk));
                }
            });
        });
    };
    DatabaseDataStore.prototype.deleteScheduledJob = function (job) {
        return this.db
            .remove(schedule_1.SCHEDULE_MODEL_NAME, job.pk, new db_api_1.EqualsConditional('state', schedule_1.SCHEDULE_STATE_DISABLED))
            // Note - no query needed for failure situation.  Either it was not disabled or already deleted.
            .then(function (count) { return count > 0; });
    };
    DatabaseDataStore.prototype.stealExpiredLeaseForScheduledJob = function (jobPk, newLeaseId, now, leaseTimeSeconds) {
        var _this = this;
        var expires = updateDate(now, leaseTimeSeconds);
        return this.db
            .conditionalUpdate(schedule_1.SCHEDULE_MODEL_NAME, jobPk, {
            state: schedule_1.SCHEDULE_STATE_REPAIR,
            leaseOwner: newLeaseId,
            leaseExpires: expires
        }, new db_api_1.AndConditional([
            new db_api_1.EqualsConditional('state', schedule_1.SCHEDULE_STATE_UPDATING),
            new db_api_1.BeforeDateConditional('leaseExpires', now),
        ]))
            .then(function (count) {
            if (count > 0) {
                return Promise.resolve();
            }
            // Failure triggers can cause the query to not look right if someone steals
            // the state between the initial conditional update and this query.
            return _this.db
                .find(schedule_1.SCHEDULE_MODEL_NAME, 0, 1, new db_api_1.EqualsConditional(model_1.MODEL_PRIMARY_KEY, jobPk))
                .then(function (jobs) {
                if (jobs.length > 0) {
                    return Promise.reject(new errors_1.LeaseNotObtainedError(newLeaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires));
                }
                else {
                    return Promise.reject(new errors_1.ScheduledJobNotFoundError(jobPk));
                }
            });
        });
    };
    DatabaseDataStore.prototype.leaseScheduledJob = function (jobPk, leaseId, now, leaseTimeSeconds) {
        var _this = this;
        var expires = updateDate(now, leaseTimeSeconds);
        return this.db
            .conditionalUpdate(schedule_1.SCHEDULE_MODEL_NAME, jobPk, {
            state: schedule_1.SCHEDULE_STATE_UPDATING,
            leaseOwner: leaseId,
            leaseExpires: expires
        }, new db_api_1.EqualsConditional('state', schedule_1.SCHEDULE_STATE_ACTIVE))
            .then(function (count) {
            if (count > 0) {
                return Promise.resolve();
            }
            // Failure triggers can cause the query to not look right if someone steals
            // the state between the initial conditional update and this query.
            return _this.db
                .find(schedule_1.SCHEDULE_MODEL_NAME, 0, 1, new db_api_1.EqualsConditional(model_1.MODEL_PRIMARY_KEY, jobPk))
                .then(function (jobs) {
                if (jobs.length > 0) {
                    return Promise.reject(new errors_1.LeaseNotObtainedError(leaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires));
                }
                else {
                    return Promise.reject(new errors_1.ScheduledJobNotFoundError(jobPk));
                }
            });
        });
    };
    DatabaseDataStore.prototype.releaseScheduledJobLease = function (leaseId, jobPk, releaseState) {
        var _this = this;
        return this.db
            .conditionalUpdate(schedule_1.SCHEDULE_MODEL_NAME, jobPk, {
            state: releaseState,
            leaseOwner: null,
            leaseExpires: null
        }, new db_api_1.AndConditional([
            new db_api_1.EqualsConditional('state', schedule_1.SCHEDULE_STATE_UPDATING),
            new db_api_1.EqualsConditional('leaseOwner', leaseId)
        ]))
            .then(function (count) {
            if (count > 0) {
                return Promise.resolve();
            }
            // Failure triggers can cause the query to not look right if someone steals
            // the state between the initial conditional update and this query.
            return _this.db
                .find(schedule_1.SCHEDULE_MODEL_NAME, 0, 1, new db_api_1.EqualsConditional(model_1.MODEL_PRIMARY_KEY, jobPk))
                .then(function (jobs) {
                if (jobs.length > 0) {
                    return Promise.reject(new errors_1.LeaseNotOwnedError(leaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires));
                }
                else {
                    return Promise.reject(new errors_1.ScheduledJobNotFoundError(jobPk));
                }
            });
        });
    };
    DatabaseDataStore.prototype.repairExpiredLeaseForScheduledJob = function (jobPk, newLeaseId, now, leaseTimeSeconds) {
        var _this = this;
        var expires = updateDate(now, leaseTimeSeconds);
        return this.db
            .conditionalUpdate(schedule_1.SCHEDULE_MODEL_NAME, jobPk, {
            state: schedule_1.SCHEDULE_STATE_DISABLED,
            // Set the lease owner to something that couldn't be leased
            leaseOwner: newLeaseId,
            // It expired in the past.
            leaseExpires: expires
        }, new db_api_1.AndConditional([
            new db_api_1.OneOfConditional('state', [schedule_1.SCHEDULE_STATE_UPDATING, schedule_1.SCHEDULE_STATE_REPAIR]),
            new db_api_1.BeforeDateConditional('leaseExpires', now)
        ]))
            .then(function (count) {
            if (count > 0) {
                return Promise.resolve();
            }
            // Failure triggers can cause the query to not look right if someone steals
            // the state between the initial conditional update and this query.
            return _this.db
                .find(schedule_1.SCHEDULE_MODEL_NAME, 0, 1, new db_api_1.EqualsConditional(model_1.MODEL_PRIMARY_KEY, jobPk))
                .then(function (jobs) {
                if (jobs.length > 0) {
                    return Promise.reject(new errors_1.LeaseNotObtainedError(newLeaseId, jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires));
                }
                else {
                    return Promise.reject(new errors_1.ScheduledJobNotFoundError(jobPk));
                }
            });
        });
    };
    DatabaseDataStore.prototype.markLeasedScheduledJobNeedsRepair = function (jobPk, now) {
        var _this = this;
        return this.db
            .conditionalUpdate(schedule_1.SCHEDULE_MODEL_NAME, jobPk, {
            leaseExpires: now
        }, new db_api_1.EqualsConditional('state', schedule_1.SCHEDULE_STATE_UPDATING))
            .then(function (count) {
            if (count > 0) {
                return Promise.resolve();
            }
            // Failure triggers can cause the query to not look right if someone steals
            // the state between the initial conditional update and this query.
            return _this.db
                .find(schedule_1.SCHEDULE_MODEL_NAME, 0, 1, new db_api_1.EqualsConditional(model_1.MODEL_PRIMARY_KEY, jobPk))
                .then(function (jobs) {
                if (jobs.length > 0) {
                    return Promise.reject(new errors_1.LeaseNotOwnedError('<unknown>', jobs[0], jobs[0].leaseOwner, jobs[0].leaseExpires));
                }
                else {
                    return Promise.reject(new errors_1.ScheduledJobNotFoundError(jobPk));
                }
            });
        });
    };
    // ------------------------------------------------------------------------
    DatabaseDataStore.prototype.pollExecutableTasks = function (now, limit) {
        return this.db
            .find(task_1.TASK_MODEL_NAME, 0, limit, new db_api_1.AndConditional([
            new db_api_1.BeforeDateConditional('executeAt', now),
            new db_api_1.EqualsConditional('state', task_1.TASK_STATE_PENDING),
        ]));
    };
    DatabaseDataStore.prototype.pollLongQueuedTasks = function (now, beforeSeconds, limit) {
        var before = updateDate(now, -beforeSeconds);
        return this.db
            .find(task_1.TASK_MODEL_NAME, 0, limit, new db_api_1.AndConditional([
            new db_api_1.BeforeDateConditional('executionQueued', before),
            new db_api_1.EqualsConditional('state', task_1.TASK_STATE_QUEUED),
        ]));
    };
    DatabaseDataStore.prototype.pollLongExecutingTasks = function (now, beforeSeconds, limit) {
        var before = updateDate(now, -beforeSeconds);
        return this.db
            .find(task_1.TASK_MODEL_NAME, 0, limit, new db_api_1.AndConditional([
            new db_api_1.BeforeDateConditional('executionStarted', before),
            new db_api_1.EqualsConditional('state', task_1.TASK_STATE_STARTED),
        ]));
    };
    DatabaseDataStore.prototype.getExecutingTasks = function (pageKey, limit) {
        var startIndex = parsePageKey(pageKey);
        return this.db
            .find(task_1.TASK_MODEL_NAME, startIndex, limit + 1, new db_api_1.EqualsConditional('state', task_1.TASK_STATE_STARTED))
            .then(function (rows) { return pageResults(rows, startIndex, limit); });
    };
    DatabaseDataStore.prototype.getPendingTasks = function (pageKey, limit) {
        var startIndex = parsePageKey(pageKey);
        return this.db
            .find(task_1.TASK_MODEL_NAME, startIndex, limit + 1, new db_api_1.EqualsConditional('state', task_1.TASK_STATE_PENDING))
            .then(function (rows) { return pageResults(rows, startIndex, limit); });
    };
    DatabaseDataStore.prototype.getFailedTasks = function (pageKey, limit, since) {
        var startIndex = parsePageKey(pageKey);
        return this.db
            .find(task_1.TASK_MODEL_NAME, startIndex, limit + 1, new db_api_1.OneOfConditional('state', [
            task_1.TASK_STATE_COMPLETE_ERROR,
            task_1.TASK_STATE_FAILED,
            task_1.TASK_STATE_FAIL_RESTARTED,
            task_1.TASK_STATE_START_ERROR,
        ]))
            .then(function (rows) { return pageResults(rows, startIndex, limit); });
    };
    DatabaseDataStore.prototype.getCompletedTasks = function (pageKey, limit, since) {
        var startIndex = parsePageKey(pageKey);
        return this.db
            .find(task_1.TASK_MODEL_NAME, startIndex, limit + 1, new db_api_1.EqualsConditional('state', task_1.TASK_STATE_COMPLETED))
            .then(function (rows) { return pageResults(rows, startIndex, limit); });
    };
    DatabaseDataStore.prototype.getFinishedTasks = function (pageKey, limit, since) {
        var startIndex = parsePageKey(pageKey);
        return this.db
            .find(task_1.TASK_MODEL_NAME, startIndex, limit + 1, new db_api_1.OneOfConditional('state', [
            task_1.TASK_STATE_COMPLETE_ERROR,
            task_1.TASK_STATE_FAILED,
            task_1.TASK_STATE_FAIL_RESTARTED,
            task_1.TASK_STATE_START_ERROR,
            task_1.TASK_STATE_COMPLETED,
        ]))
            .then(function (rows) { return pageResults(rows, startIndex, limit); });
    };
    DatabaseDataStore.prototype.addTask = function (task) {
        var data = __assign({}, task);
        return this.db.create(task_1.TASK_MODEL_NAME, data);
    };
    DatabaseDataStore.prototype.getTask = function (pk) {
        return this.db
            .find(task_1.TASK_MODEL_NAME, 0, 1, new db_api_1.EqualsConditional(model_1.MODEL_PRIMARY_KEY, pk))
            .then(function (rows) { return rows.length > 0 ? rows[0] : null; });
    };
    DatabaseDataStore.prototype.getTaskByExecutionJobId = function (execJobId) {
        return this.db
            .find(task_1.TASK_MODEL_NAME, 0, 2, new db_api_1.EqualsConditional('executionJobId', execJobId))
            .then(function (rows) {
            if (rows.length <= 0) {
                return null;
            }
            if (rows.length === 1) {
                return rows[0];
            }
            throw new errors_1.DuplicatePrimaryKeyError(task_1.TASK_MODEL_NAME, execJobId);
        });
    };
    DatabaseDataStore.prototype.getActiveTasksForScheduledJob = function (scheduledJob, limit) {
        return this.db
            .find(task_1.TASK_MODEL_NAME, 0, limit, new db_api_1.AndConditional([
            new db_api_1.EqualsConditional('schedule', scheduledJob.pk),
            new db_api_1.OneOfConditional('state', [
                task_1.TASK_STATE_PENDING,
                task_1.TASK_STATE_QUEUED,
                task_1.TASK_STATE_STARTED,
            ])
        ]));
    };
    DatabaseDataStore.prototype.markTaskQueued = function (task, now) {
        return this.markTaskState(task.pk, task_1.TASK_STATE_PENDING, task_1.TASK_STATE_QUEUED, {
            executionQueued: now
        });
    };
    DatabaseDataStore.prototype.markTaskStarted = function (task, now, executionId) {
        return this
            .markTaskState(task.pk, task_1.TASK_STATE_QUEUED, task_1.TASK_STATE_STARTED, {
            executionStarted: now,
            executionJobId: executionId
        });
    };
    DatabaseDataStore.prototype.markTaskStartFailed = function (task, now, reason) {
        return this.markTaskState(task.pk, task_1.TASK_STATE_QUEUED, task_1.TASK_STATE_START_ERROR, {
            executionStarted: now,
            completedInfo: reason
        });
    };
    DatabaseDataStore.prototype.markTaskCompleted = function (task, now, info) {
        return this.markTaskState(task.pk, task_1.TASK_STATE_STARTED, task_1.TASK_STATE_COMPLETED, {
            executionFinished: now,
            completedInfo: info
        });
    };
    DatabaseDataStore.prototype.markTaskFailed = function (task, now, expectedCurrentState, failedState, info) {
        return this.markTaskState(task.pk, expectedCurrentState, failedState, {
            executionFinished: now,
            completedInfo: info
        });
    };
    DatabaseDataStore.prototype.markTaskState = function (pk, expectedCurrentState, newState, extra) {
        var _this = this;
        var extraData = extra || {};
        return this.db
            .conditionalUpdate(task_1.TASK_MODEL_NAME, pk, __assign({}, extraData, { state: newState }), new db_api_1.AndConditional([
            new db_api_1.EqualsConditional('state', expectedCurrentState)
        ]))
            .then(function (count) {
            if (count > 0) {
                return Promise.resolve();
            }
            // Failure triggers can cause the query to not look right if someone steals
            // the state between the initial conditional update and this query.
            return _this.db
                .find(task_1.TASK_MODEL_NAME, 0, 1, new db_api_1.EqualsConditional(model_1.MODEL_PRIMARY_KEY, pk))
                .then(function (tasks) {
                if (tasks.length > 0) {
                    return Promise.reject(new errors_1.InvalidTaskStateError(tasks[0], newState, expectedCurrentState));
                }
                else {
                    return Promise.reject(new controller_errors_1.TaskNotFoundError(pk));
                }
            });
        });
    };
    DatabaseDataStore.prototype.deleteFinishedTask = function (task) {
        return this.db
            .remove(task_1.TASK_MODEL_NAME, task.pk, new db_api_1.OneOfConditional('state', [
            task_1.TASK_STATE_COMPLETE_ERROR,
            task_1.TASK_STATE_FAILED,
            task_1.TASK_STATE_FAIL_RESTARTED,
            task_1.TASK_STATE_START_ERROR,
            task_1.TASK_STATE_COMPLETED,
        ]))
            .then(function (count) { return count > 0; });
    };
    return DatabaseDataStore;
}());
exports.DatabaseDataStore = DatabaseDataStore;

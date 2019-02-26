"use strict";
exports.__esModule = true;
var wire_1 = require("./wire");
exports.wireDataStore = wire_1.wireDataStore;
exports.pollLongExecutingTasks = wire_1.pollLongExecutingTasks;
exports.pollLongQueuedTasks = wire_1.pollLongQueuedTasks;
exports.pollScheduledJobsForExpiredLeases = wire_1.pollScheduledJobsForExpiredLeases;
exports.pollScheduledJobsForTaskCreation = wire_1.pollScheduledJobsForTaskCreation;
exports.pollTaskReadyToExecute = wire_1.pollTaskReadyToExecute;
var memory_1 = require("./datastore/memory");
exports.createMemoryDataStore = memory_1.createMemoryDataStore;
var executor_1 = require("./executor");
exports.isJobExecutionStateCompleted = executor_1.isJobExecutionStateCompleted;
exports.isJobExecutionStateFailed = executor_1.isJobExecutionStateFailed;
exports.isJobExecutionStateRunning = executor_1.isJobExecutionStateRunning;
var strategies_1 = require("./strategies");
exports.DUPLICATE_TASK_RUN_NEW = strategies_1.DUPLICATE_TASK_RUN_NEW;
exports.DUPLICATE_TASK_SKIP_NEW = strategies_1.DUPLICATE_TASK_SKIP_NEW;
var events_1 = require("events");
var strategies_2 = require("./strategies");
var time_1 = require("./strategies/time");
var uuid_1 = require("./strategies/primary-key/uuid");
var lease_id_1 = require("./strategies/lease-id");
var wire_2 = require("./wire");
var duplicate_task_1 = require("./strategies/duplicate-task");
var MILLISECONDS_PER_SECOND = 1000;
/**
 * A public facing facade on top of all the fun stuff in the scheduler.
 */
var TernScheduler = /** @class */ (function () {
    function TernScheduler(args) {
        var _this = this;
        this.runningCallbacks = {};
        this.active = true;
        this.store = args.store;
        this.jobExecution = args.jobExecution;
        this.createLeaseTimeInSecondsStrategy = args.createLeaseTimeInSecondsStrategy;
        this.generatePollWaitTimesStrategy = args.generatePollWaitTimesStrategy;
        this.createPrimaryKeyStrategy = args.createPrimaryKeyStrategy || uuid_1.UUIDCreatePrimaryKeyStrategy;
        this.createLeaseIdStrategy = args.createLeaseIdStrategy || lease_id_1.UUIDCreateLeaseIdStrategy;
        this.currentTimeUTCStrategy = args.currentTimeUTCStrategy || time_1.StandardTime;
        this.taskCreationStrategyRegistry = strategies_2.createStrategyRegistry();
        this.duplicateTaskStrategyRegistry = strategies_2.createStrategyRegistry();
        duplicate_task_1.registerAlwaysRunDuplicateTaskStrategy(this.duplicateTaskStrategyRegistry);
        duplicate_task_1.registerAlwaysSkipDuplicateTaskStrategy(this.duplicateTaskStrategyRegistry);
        this.retryTaskStrategyRegistry = strategies_2.createStrategyRegistry();
        this.registerPollCallback = function (delaySeconds, callback) {
            if (_this.active) {
                var id_1 = _this.createPrimaryKeyStrategy();
                _this.runningCallbacks[id_1] = callback;
                setTimeout(function () {
                    if (_this.active) {
                        // TODO error trapping
                        try {
                            callback();
                        }
                        catch (e) {
                            _this.messaging.emit('generalError', e);
                        }
                    }
                    delete _this.runningCallbacks[id_1];
                }, delaySeconds * MILLISECONDS_PER_SECOND);
            }
        };
        this.messaging = new events_1["default"]();
        this.leaseBehavior = {
            leaseOwnerStrategy: this.createLeaseIdStrategy,
            leaseTimeSeconds: this.createLeaseTimeInSecondsStrategy(),
            retrySecondsDelay: args.retryLeaseTimeStrategy(),
            registerRetryCallback: this.registerPollCallback
        };
        this.jobExecution.withMessaging(this.messaging);
        wire_2.wireDataStore(this.store, this.messaging, this.leaseBehavior, this.jobExecution, this.retryTaskStrategyRegistry, this.duplicateTaskStrategyRegistry, this.taskCreationStrategyRegistry, this.createPrimaryKeyStrategy, this.currentTimeUTCStrategy);
    }
    /**
     * Add polling for long executing tasks to the event emitter, for systems
     * where the job executor or message bus does not provide this behavior.
     *
     * Tasks which are considered "long executing" tells the system that they
     * have gone beyond the normal execution time, and probably have encountered
     * a partial failure, and need some corrective action.
     *
     * If the job execution framework provides this behavior, then it SHOULD NOT
     * be invoked.
     *
     * @param longTimeSeconds what should be considered a "long time" for the task to be executing.
     */
    TernScheduler.prototype.pollLongExecutingTasks = function (longTimeSeconds) {
        wire_2.pollLongExecutingTasks(this.store, longTimeSeconds, this.generatePollWaitTimesStrategy, this.registerPollCallback, this.messaging);
    };
    /**
     * Add polling for long queued tasks to the event emitter, for systems where
     * the message bus does not provide this behavior.
     *
     * Tasks which are considered "long queued" means that the time between when
     * a request to the job executor to start the job and when it returned has
     * gone beyond the normal time expected for this operation, and probably
     * means that the request has encountered a partial failure.  The task
     * may need some corrective action, such as make another request.
     *
     * @param longTimeSeconds what should be considered a "long time" for the task to be executing.
     */
    TernScheduler.prototype.pollLongQueuedTasks = function (longTimeSeconds) {
        wire_2.pollLongQueuedTasks(this.store, longTimeSeconds, this.generatePollWaitTimesStrategy, this.registerPollCallback, this.messaging);
    };
    /**
     * Monitor the scheduled jobs for expired leases.  This may indicate that the
     * lease times are too short, and need to be extended to handle the longer
     * operations.  Or, it could mean that some operation failed or a node
     * crashed, and may need repairs.
     *
     * Note that any discovered expired lease scheduled job may have its lease
     * stolen before it can be repaired.
     */
    TernScheduler.prototype.pollScheduledJobsForExpiredLeases = function () {
        wire_2.pollScheduledJobsForExpiredLeases(this.store, this.generatePollWaitTimesStrategy, this.currentTimeUTCStrategy, this.registerPollCallback, this.messaging);
    };
    /**
     * Monitor for when a scheduled job should have a new task "peeled" off.
     */
    TernScheduler.prototype.pollScheduledJobsForTaskCreation = function () {
        wire_2.pollScheduledJobsForTaskCreation(this.store, this.generatePollWaitTimesStrategy, this.currentTimeUTCStrategy, this.registerPollCallback, this.messaging);
    };
    /**
     * Monitors for when a task is ready to initiate the job execution service.
     */
    TernScheduler.prototype.pollTaskReadyToExecute = function () {
        wire_2.pollTaskReadyToExecute(this.store, this.generatePollWaitTimesStrategy, this.registerPollCallback, this.messaging);
    };
    return TernScheduler;
}());
exports.TernScheduler = TernScheduler;

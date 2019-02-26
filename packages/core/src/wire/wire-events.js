"use strict";
exports.__esModule = true;
var controller_1 = require("../controller");
var logging_1 = require("../logging");
/**
 * Wires up events between the data store and the event monitor and the job executor.
 *
 * Events that require polling are handled elsewhere.
 */
function wireDataStore(store, messaging, leaseBehavior, jobExecutor, retryReg, duplicateReg, taskCreationReg, createPrimaryKeyStrat, currentTimeUTC) {
    jobExecutor.withMessaging(messaging);
    messaging
        .on('generalError', function (e) {
        // Standard log handling.  End users can monitor this in their own way.
        logging_1.logCriticalError(e);
    })
        .on('scheduledJobLeaseExpired', function (schedule) {
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        // FIXME need to handle fixing expired job leases.
        logging_1.logNotificationError("scheduled job expired: " + schedule.pk, null);
    })
        .on('taskReadyToExecute', function (task) {
        var now = currentTimeUTC();
        controller_1.startTask(store, task, leaseBehavior, now, jobExecutor.startJob, taskCreationReg, currentTimeUTC, createPrimaryKeyStrat, messaging)["catch"](function (e) {
            messaging.emit('generalError', e);
        });
    })
        .on('taskExecutingLong', function (task) {
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        logging_1.logNotificationError("task execution took too long: " + task.pk, null);
    })
        .on('taskQueuedLong', function (task) {
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        // FIXME inspect the task for repair
        logging_1.logNotificationError("task queue took too long: " + task.pk, null);
    })
        .on('jobExecutionFinished', function (execId, result) {
        var now = currentTimeUTC();
        controller_1.taskFinished(store, execId, result, now, leaseBehavior, createPrimaryKeyStrat, retryReg, taskCreationReg, duplicateReg, messaging)["catch"](function (e) {
            messaging.emit('generalError', e);
        });
    });
}
exports.wireDataStore = wireDataStore;

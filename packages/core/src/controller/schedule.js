"use strict";
/**
 * Augments to the DataStore behavior...
 */
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
var errors_1 = require("../errors");
var logging_1 = require("../logging");
var schedule_1 = require("../model/schedule");
function isLeaseExitStateValue(v) {
    return !!v.value;
}
function isLeaseExitStateError(v) {
    return !!v.error;
}
/**
 * Creates the scheduled job in a leased state, then runs the `withLease` action,
 * then releases the lease.  Any generated error will put the scheduled job
 * into a needs-repair state.
 *
 * All errors in the returned promise have not been reported to the messaging
 * events.  Only internal errors that would otherwise mask the more important
 * errors are reported to the messaging events.
 *
 * For internal use of the controller; end-users should use the
 * `combined` method instead.
 */
function createScheduledJobAlone(store, scheduledJob, now, leaseBehavior, pkStrategy, messaging, withLease) {
    var leaseOwner = leaseBehavior.leaseOwnerStrategy();
    var sched = __assign({}, scheduledJob, { state: schedule_1.SCHEDULE_STATE_UPDATING, createdOn: now, pk: pkStrategy() });
    logging_1.logDebug('createScheduledJob', "starting addScheduledJobModel");
    return store
        .addScheduledJobModel(sched, leaseOwner, now, leaseBehavior.leaseTimeSeconds)["catch"](function (e) { logging_1.logDebug("caught addSchJob error", e); throw e; })
        // With the lease, perform the update behavior.
        .then(function () {
        logging_1.logDebug('createScheduledJob', "after addScheduledJobModel succeeded");
        // If the with-lease execution fails, then mark the update lease failure.
        // That means we need special handling just in here...
        var t;
        try {
            t = withLease(sched);
        }
        catch (e) {
            // The job must enter a needs-repair state.
            t = {
                error: e,
                state: schedule_1.SCHEDULE_STATE_DISABLED
            };
        }
        if (t instanceof Promise) {
            return t["catch"](function (e) { return ({ error: e, state: schedule_1.SCHEDULE_STATE_REPAIR }); });
        }
        else {
            // It's fine.  Right?
            return Promise.resolve(t);
        }
    })["catch"](function (e) {
        // Some problem was thrown while performing the other logic in the above
        // block.  This is a critical internal error.
        return store
            .markLeasedScheduledJobNeedsRepair(sched.pk, now)["catch"](function (e2) {
            // Lease release failed.  It's not as important as the inner error,
            // so report it and rethrow the inner error.
            messaging.emit('generalError', e2);
            throw e;
        })
            .then(function () { return Promise.reject(e); });
    })
        // With successful update behavior, release the lease and return the result.
        .then(function (result) {
        var endState = result.state || schedule_1.SCHEDULE_STATE_ACTIVE;
        return (endState === schedule_1.SCHEDULE_STATE_REPAIR
            ? store.markLeasedScheduledJobNeedsRepair(sched.pk, now)
            : store.releaseScheduledJobLease(leaseOwner, sched.pk, endState))["catch"](function (e) {
            // The lease release failed.  This error isn't as important as
            // the underlying original error...
            if (isLeaseExitStateError(result)) {
                messaging.emit('generalError', e);
                throw result.error;
            }
            // No "more important" error, so report this one.
            throw e;
        })
            .then(function () {
            if (isLeaseExitStateError(result)) {
                throw result.error;
            }
            return result.value;
        });
    });
}
exports.createScheduledJobAlone = createScheduledJobAlone;
/**
 * Runs an operation inside a lease.  This captures the lease, and, only if the lease
 * capture is successful, it runs the lease then releases the lease.
 *
 * Only errors that, if thrown, would mask inner errors are reported to the events.
 * All other errors are just rejected in the promise.
 *
 * NOTE this does not steal the lease.
 *
 * @param store
 * @param jobPk
 * @param now
 * @param leaseBehavior
 * @param withLease
 */
function runUpdateInLease(store, jobPk, now, leaseBehavior, messaging, withLease) {
    var leaser = leaseBehavior.leaseOwnerStrategy();
    // Retry logic with a promise is weird...
    function rejectDelay(timeout) {
        return function (reason) { return new Promise(function (_, reject) {
            logging_1.logNotificationError("attempting to retry the operation in " + timeout + " seconds", reason);
            leaseBehavior.registerRetryCallback(timeout, function () { return reject(reason); });
        }); };
    }
    var leaseAttemptPromise = store.leaseScheduledJob(jobPk, leaser, now, leaseBehavior.leaseTimeSeconds);
    for (var _i = 0, _a = leaseBehavior.retrySecondsDelay; _i < _a.length; _i++) {
        var retrySeconds = _a[_i];
        leaseAttemptPromise = leaseAttemptPromise["catch"](rejectDelay(retrySeconds))["catch"](function (_) { return store.leaseScheduledJob(jobPk, leaser, now, leaseBehavior.leaseTimeSeconds); });
    }
    // leaseAttemptPromise is now setup such that if the last attempt failed, it will
    // be in the catch() block, and if it passed, then the then() block has the result.
    return leaseAttemptPromise
        .then(function () { return store.getJob(jobPk); })
        .then(function (sched) {
        logging_1.logDebug('createScheduledJob', "after addScheduledJobModel succeeded");
        if (!sched) {
            throw new errors_1.ScheduledJobNotFoundError(jobPk);
        }
        // If the with-lease execution fails, then mark the update lease failure.
        // That means we need special handling just in here...
        var t;
        try {
            t = withLease(sched, leaser);
        }
        catch (e) {
            // The scheduled job must enter a needs-repair state.
            t = {
                error: e,
                state: schedule_1.SCHEDULE_STATE_DISABLED
            };
        }
        if (!(t instanceof Promise)) {
            t = Promise.resolve(t);
        }
        return t["catch"](function (e) { return ({ error: e, state: schedule_1.SCHEDULE_STATE_REPAIR }); })
            // With successful update behavior, release the lease and return the result.
            .then(function (result) {
            var endState = result.state || schedule_1.SCHEDULE_STATE_ACTIVE;
            return (endState === schedule_1.SCHEDULE_STATE_REPAIR
                ? store.markLeasedScheduledJobNeedsRepair(sched.pk, now)
                : store.releaseScheduledJobLease(leaser, sched.pk, endState))["catch"](function (e) {
                // The lease release failed.  This error isn't as important as
                // the underlying original error...
                if (isLeaseExitStateError(result)) {
                    messaging.emit('generalError', e);
                    throw result.error;
                }
                // No "more important" error, so report this one.
                throw e;
            })
                .then(function () {
                if (isLeaseExitStateError(result)) {
                    throw result.error;
                }
                return result.value;
            });
        });
    });
}
exports.runUpdateInLease = runUpdateInLease;

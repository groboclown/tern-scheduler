"use strict";
exports.__esModule = true;
var poll_1 = require("../strategies/poll");
var POLL_JOBS_LIMIT = 10;
/**
 * Polls the data store for scheduled jobs ready to create tasks.
 */
function pollScheduledJobsForTaskCreation(store, pollStrat, currentTimeUTC, registerPoll, messaging) {
    poll_1.pollLoop(pollStrat, registerPoll, function () { return store
        .pollTaskableScheduledJobs(currentTimeUTC(), POLL_JOBS_LIMIT)
        .then(function (jobs) {
        jobs.forEach(function (job) {
            messaging.emit('scheduledJobTaskCheck', job);
        });
    })["catch"](function (e) {
        messaging.emit('generalError', e);
        // Don't stop with this one error; keep running the poll
        return Promise.resolve();
    }); });
}
exports.pollScheduledJobsForTaskCreation = pollScheduledJobsForTaskCreation;
function pollScheduledJobsForExpiredLeases(store, pollStrat, currentTimeUTC, registerPoll, messaging) {
    poll_1.pollLoop(pollStrat, registerPoll, function () { return store
        .pollLeaseExpiredScheduledJobs(currentTimeUTC(), POLL_JOBS_LIMIT)
        .then(function (jobs) {
        jobs.forEach(function (job) {
            messaging.emit('scheduledJobLeaseExpired', job);
        });
    })["catch"](function (e) {
        messaging.emit('generalError', e);
        // Don't stop with this one error; keep running the poll
        return Promise.resolve();
    }); });
}
exports.pollScheduledJobsForExpiredLeases = pollScheduledJobsForExpiredLeases;

"use strict";
exports.__esModule = true;
var time_util_1 = require("../internal/time-util");
var poll_1 = require("../strategies/poll");
var POLL_TASKS_LIMIT = 10;
function pollTaskReadyToExecute(store, pollStrat, registerPoll, messaging) {
    poll_1.pollLoop(pollStrat, registerPoll, function () { return store
        .pollExecutableTasks(time_util_1.currentTimeUTC(), POLL_TASKS_LIMIT)
        .then(function (tasks) {
        tasks.forEach(function (task) {
            messaging.emit('taskReadyToExecute', task);
        });
    })["catch"](function (e) {
        messaging.emit('generalError', e);
        return Promise.resolve();
    }); });
}
exports.pollTaskReadyToExecute = pollTaskReadyToExecute;
function pollLongQueuedTasks(store, timeoutSeconds, pollStrat, registerPoll, messaging) {
    poll_1.pollLoop(pollStrat, registerPoll, function () { return store
        .pollLongQueuedTasks(time_util_1.currentTimeUTC(), timeoutSeconds, POLL_TASKS_LIMIT)
        .then(function (tasks) {
        tasks.forEach(function (task) {
            messaging.emit('taskQueuedLong', task);
        });
    })["catch"](function (e) {
        messaging.emit('generalError', e);
        return Promise.resolve();
    }); });
}
exports.pollLongQueuedTasks = pollLongQueuedTasks;
function pollLongExecutingTasks(store, timeoutSeconds, pollStrat, registerPoll, messaging) {
    poll_1.pollLoop(pollStrat, registerPoll, function () { return store
        .pollLongExecutingTasks(time_util_1.currentTimeUTC(), timeoutSeconds, POLL_TASKS_LIMIT)
        .then(function (tasks) {
        tasks.forEach(function (task) {
            messaging.emit('taskExecutingLong', task);
        });
    })["catch"](function (e) {
        messaging.emit('generalError', e);
        return Promise.resolve();
    }); });
}
exports.pollLongExecutingTasks = pollLongExecutingTasks;

"use strict";
exports.__esModule = true;
function isJobExecutionStateRunning(v) {
    return v.state === 'running';
}
exports.isJobExecutionStateRunning = isJobExecutionStateRunning;
function isJobExecutionStateCompleted(v) {
    return v.state === 'completed';
}
exports.isJobExecutionStateCompleted = isJobExecutionStateCompleted;
function isJobExecutionStateFailed(v) {
    return v.state === 'failed';
}
exports.isJobExecutionStateFailed = isJobExecutionStateFailed;

"use strict";
exports.__esModule = true;
function isTaskCreationQueue(v) {
    return v.action === 'queue';
}
exports.isTaskCreationQueue = isTaskCreationQueue;
function isTaskCreationDisable(v) {
    return v.action === 'disable';
}
exports.isTaskCreationDisable = isTaskCreationDisable;
function isTaskCreationStrategyAfterFinish(v) {
    return v.after === 'finish';
}
exports.isTaskCreationStrategyAfterFinish = isTaskCreationStrategyAfterFinish;
function isTaskCreationStrategyAfterStart(v) {
    return v.after === 'start';
}
exports.isTaskCreationStrategyAfterStart = isTaskCreationStrategyAfterStart;
function isTaskCreationStrategyAfterCreation(v) {
    return v.after === 'new';
}
exports.isTaskCreationStrategyAfterCreation = isTaskCreationStrategyAfterCreation;

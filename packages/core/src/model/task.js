"use strict";
exports.__esModule = true;
/** The record is peding execution and is not locked. */
exports.TASK_STATE_PENDING = 'pending';
/** A server marked the record as being updated */
exports.TASK_STATE_QUEUED = 'queued';
/** A server who owns the queued record marks it as running the associated task. */
exports.TASK_STATE_STARTED = 'started';
/** The server who owns the queue encountered an error trying to start the task. */
exports.TASK_STATE_START_ERROR = 'start-error';
/**
 * A server is checking the completion state of the job, and can potentially
 * update the state.
 */
exports.TASK_STATE_COMPLETE_QUEUED = 'complete-queued';
/**
 * A server who owns the queued complete record encountered an error trying to get
 * the task status.
 */
exports.TASK_STATE_COMPLETE_ERROR = 'complete-error';
/** Job execution reported result - failed execution */
exports.TASK_STATE_FAILED = 'failed';
/** Job execution reported result - failed execution, job execution engine triggered a restart of the task. */
exports.TASK_STATE_FAIL_RESTARTED = 'fail-restarted';
/** Job execution reported result - completed execution without failure */
exports.TASK_STATE_COMPLETED = 'completed';
exports.TASK_MODEL_NAME = 'task';

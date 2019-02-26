"use strict";
exports.__esModule = true;
exports.DUPLICATE_TASK_SKIP_NEW = 'skip';
exports.DUPLICATE_TASK_RUN_NEW = 'run';
exports.ALWAYS_SKIP_DUPLICATE_TASK_NAME = 'always-skip';
exports.ALWAYS_RUN_DUPLICATE_TASK_NAME = 'always-run';
function registerAlwaysSkipDuplicateTaskStrategy(reg) {
    reg.register(exports.ALWAYS_SKIP_DUPLICATE_TASK_NAME, function () { return exports.DUPLICATE_TASK_SKIP_NEW; });
}
exports.registerAlwaysSkipDuplicateTaskStrategy = registerAlwaysSkipDuplicateTaskStrategy;
function registerAlwaysRunDuplicateTaskStrategy(reg) {
    reg.register(exports.ALWAYS_RUN_DUPLICATE_TASK_NAME, function () { return exports.DUPLICATE_TASK_RUN_NEW; });
}
exports.registerAlwaysRunDuplicateTaskStrategy = registerAlwaysRunDuplicateTaskStrategy;

"use strict";
exports.__esModule = true;
var time_util_1 = require("../internal/time-util");
// Default strategy used by everything except unit tests.
exports.StandardTime = time_util_1.currentTimeUTC;
exports.STANDARD_TIME_STRATEGY = 'standard';
function registerStandardTimeStrategy(reg) {
    reg.register(exports.STANDARD_TIME_STRATEGY, exports.StandardTime);
}
exports.registerStandardTimeStrategy = registerStandardTimeStrategy;

"use strict";
exports.__esModule = true;
var errors_1 = require("../errors");
/**
 * Performs the general polling loop.  The callback should handle its own
 * errors.
 *
 * @param pollStrat
 * @param callback
 */
function pollLoop(pollStrat, registerPollCallback, onPoll) {
    var pollTimes = pollStrat();
    if (pollTimes.length <= 0) {
        throw new errors_1.TernError("Invalid poll times: no values");
    }
    var pollIndex = 0;
    var pollCallback = function () {
        var pollTime = pollTimes[pollIndex];
        pollIndex = (pollIndex + 1) % pollTimes.length;
        onPoll()
            .then(function () { return registerPollCallback(pollTime, pollCallback); });
        // If the registerPollCallback call raises an error, it's a bad day.
    };
}
exports.pollLoop = pollLoop;

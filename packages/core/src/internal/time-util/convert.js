"use strict";
exports.__esModule = true;
function toUTC(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}
exports.toUTC = toUTC;
var SECONDS_TO_MILLS = 60 * 1000;
function fromUTC(dateUTC, timezoneOffsetMinutes) {
    return new Date(dateUTC.valueOf() + timezoneOffsetMinutes * SECONDS_TO_MILLS);
}
exports.fromUTC = fromUTC;

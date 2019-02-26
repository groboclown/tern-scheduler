"use strict";
exports.__esModule = true;
exports.DEBUG = false;
exports.INFO = true;
function logCriticalError(e) {
    console.error('ERROR:', e);
}
exports.logCriticalError = logCriticalError;
function logNotificationError(reasonIsJustNotify, e) {
    console.log("NOTE: " + reasonIsJustNotify, e);
}
exports.logNotificationError = logNotificationError;
function logDebug(src, msg, e) {
    if (exports.DEBUG) {
        if (!e) {
            console.log("DEBUG: " + src + " : " + msg);
        }
        else {
            console.log("DEBUG: " + src + " : " + msg, e);
        }
    }
}
exports.logDebug = logDebug;
function logInfo(src, msg, e) {
    if (exports.INFO) {
        if (!e) {
            console.log("INFO: " + src + " : " + msg);
        }
        else {
            console.log("INFO: " + src + " : " + msg, e);
        }
    }
}
exports.logInfo = logInfo;

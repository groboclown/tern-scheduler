"use strict";
exports.__esModule = true;
var v5_1 = require("uuid/v5");
exports.UUIDHostname = {
    hostname: process.env.HOSTNAME === undefined
        ? 'localhost'
        : process.env.HOSTNAME
};
exports.UUIDCreateLeaseIdStrategy = function () {
    return v5_1["default"](exports.UUIDHostname.hostname, v5_1["default"].DNS);
};
exports.UUID_PK_STRAT_NAME = 'uuid';
function addUUIDCreateLeaseIdStrategy(registry) {
    registry.register(exports.UUID_PK_STRAT_NAME, exports.UUIDCreateLeaseIdStrategy);
}
exports.addUUIDCreateLeaseIdStrategy = addUUIDCreateLeaseIdStrategy;

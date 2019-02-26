"use strict";
exports.__esModule = true;
var v5_1 = require("uuid/v5");
exports.UUIDHostname = {
    hostname: process.env.HOSTNAME === undefined
        ? 'localhost'
        : process.env.HOSTNAME
};
exports.UUIDCreatePrimaryKeyStrategy = function () {
    return v5_1["default"](exports.UUIDHostname.hostname, v5_1["default"].DNS);
};
exports.UUID_PK_STRAT_NAME = 'uuid';
function addUUIDCreatePrimaryKeyStrategy(registry) {
    registry.register(exports.UUID_PK_STRAT_NAME, exports.UUIDCreatePrimaryKeyStrategy);
}
exports.addUUIDCreatePrimaryKeyStrategy = addUUIDCreatePrimaryKeyStrategy;

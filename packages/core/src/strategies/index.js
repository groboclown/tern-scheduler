"use strict";
exports.__esModule = true;
var lease_id_1 = require("./lease-id");
exports.addUUIDCreateLeaseIdStrategy = lease_id_1.addUUIDCreateLeaseIdStrategy;
var duplicate_task_1 = require("./duplicate-task");
exports.DUPLICATE_TASK_RUN_NEW = duplicate_task_1.DUPLICATE_TASK_RUN_NEW;
exports.DUPLICATE_TASK_SKIP_NEW = duplicate_task_1.DUPLICATE_TASK_SKIP_NEW;
var time_1 = require("./time");
exports.registerStandardTimeStrategy = time_1.registerStandardTimeStrategy;
var StrategyRegistryImpl = /** @class */ (function () {
    function StrategyRegistryImpl() {
        this.reg = {};
    }
    StrategyRegistryImpl.prototype.register = function (name, strat) {
        this.reg[name] = strat;
    };
    StrategyRegistryImpl.prototype.get = function (name) {
        var ret = this.reg[name];
        if (!ret) {
            throw new Error("No such registered strategy \"" + name + "\"");
        }
        return ret;
    };
    return StrategyRegistryImpl;
}());
function createStrategyRegistry() {
    return new StrategyRegistryImpl();
}
exports.createStrategyRegistry = createStrategyRegistry;

"use strict";
exports.__esModule = true;
var errors_1 = require("../errors");
var AbstractStrategyRegistry = /** @class */ (function () {
    function AbstractStrategyRegistry(strategyType) {
        this.strategyType = strategyType;
        this.registry = {};
    }
    AbstractStrategyRegistry.prototype.register = function (name, strat) {
        this.registry[name] = strat;
    };
    // Throws an exception if not found
    AbstractStrategyRegistry.prototype.get = function (name) {
        var ret = this.registry[name];
        if (!ret) {
            throw new errors_1.StrategyNotRegisteredError(this.strategyType, name);
        }
        return ret;
    };
    return AbstractStrategyRegistry;
}());
exports.AbstractStrategyRegistry = AbstractStrategyRegistry;

"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var base_1 = require("./base");
var StrategyNotRegisteredError = /** @class */ (function (_super) {
    __extends(StrategyNotRegisteredError, _super);
    function StrategyNotRegisteredError(strategyType, strategyName) {
        var _this = _super.call(this, "Strategy " + strategyName + " not registered as a " + strategyType) || this;
        // Error workaround fun
        _this.name = StrategyNotRegisteredError.name;
        Object.setPrototypeOf(_this, StrategyNotRegisteredError.prototype);
        return _this;
    }
    return StrategyNotRegisteredError;
}(base_1.TernError));
exports.StrategyNotRegisteredError = StrategyNotRegisteredError;

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
var TernError = /** @class */ (function (_super) {
    __extends(TernError, _super);
    function TernError(message) {
        var _this = _super.call(this, message) || this;
        // Error workaround fun
        _this.name = TernError.name;
        Object.setPrototypeOf(_this, TernError.prototype);
        return _this;
    }
    return TernError;
}(Error));
exports.TernError = TernError;

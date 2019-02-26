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
var DataStoreError = /** @class */ (function (_super) {
    __extends(DataStoreError, _super);
    function DataStoreError(message) {
        var _this = _super.call(this, message) || this;
        // Error workaround fun
        _this.name = DataStoreError.name;
        Object.setPrototypeOf(_this, DataStoreError.prototype);
        return _this;
    }
    return DataStoreError;
}(base_1.TernError));
exports.DataStoreError = DataStoreError;
var DuplicatePrimaryKeyError = /** @class */ (function (_super) {
    __extends(DuplicatePrimaryKeyError, _super);
    function DuplicatePrimaryKeyError(modelName, pk) {
        var _this = _super.call(this, modelName + " already has primary key " + pk) || this;
        _this.modelName = modelName;
        _this.pk = pk;
        // Error workaround fun
        _this.name = DuplicatePrimaryKeyError.name;
        Object.setPrototypeOf(_this, DuplicatePrimaryKeyError.prototype);
        return _this;
    }
    return DuplicatePrimaryKeyError;
}(DataStoreError));
exports.DuplicatePrimaryKeyError = DuplicatePrimaryKeyError;
var NoSuchModelError = /** @class */ (function (_super) {
    __extends(NoSuchModelError, _super);
    function NoSuchModelError(modelName) {
        var _this = _super.call(this, "No such model " + modelName) || this;
        _this.modelName = modelName;
        // Error workaround fun
        _this.name = NoSuchModelError.name;
        Object.setPrototypeOf(_this, NoSuchModelError.prototype);
        return _this;
    }
    return NoSuchModelError;
}(DataStoreError));
exports.NoSuchModelError = NoSuchModelError;

"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var api = require("./db-api");
var impl = require("./db-impl");
var model = require("../model");
var errors = require("../errors");
var TABLES = [model.SCHEDULE_MODEL_NAME, model.TASK_MODEL_NAME];
function createMemoryDataStore() {
    return new impl.DatabaseDataStore(new MemoryDatabase());
}
exports.createMemoryDataStore = createMemoryDataStore;
function conditionalMatchesRecord(record, cnd) {
    if (!record) {
        return false;
    }
    if (api.isAndConditional(cnd)) {
        for (var _i = 0, _a = cnd.conditionals; _i < _a.length; _i++) {
            var c = _a[_i];
            var res = conditionalMatchesRecord(record, c);
            if (!res) {
                return false;
            }
        }
        return true;
    }
    if (api.isOrConditional(cnd)) {
        for (var _b = 0, _c = cnd.conditionals; _b < _c.length; _b++) {
            var c = _c[_b];
            var res = conditionalMatchesRecord(record, c);
            if (res) {
                return true;
            }
        }
        return false;
    }
    if (api.isEqualsConditional(cnd)) {
        var val = record[cnd.key];
        return val === cnd.value;
    }
    if (api.isAfterDateConditional(cnd)) {
        var val = record[cnd.key];
        return val instanceof Date && cnd.after > val;
    }
    if (api.isBeforeDateConditional(cnd)) {
        var val = record[cnd.key];
        return val instanceof Date && cnd.before < val;
    }
    if (api.isOneOfConditional(cnd)) {
        var val = record[cnd.key];
        return cnd.values.indexOf(val) >= 0;
    }
    throw new Error("Unknown conditional type " + cnd.type);
}
function matchesRecord(row, conditional) {
    var arow = row;
    return conditionalMatchesRecord(arow, conditional);
}
var Table = /** @class */ (function () {
    function Table(name) {
        this.name = name;
        this.rows = [];
        this.pks = {};
    }
    Table.prototype.matches = function (primaryKey, conditional) {
        return this.rows.filter(function (v) { return (!primaryKey || v.pk === primaryKey)
            && (!conditional || matchesRecord(v, conditional)); });
    };
    Table.prototype.add = function (row) {
        var pk = row.pk;
        if (!pk || !!(this.pks[pk])) {
            return false;
        }
        this.pks[pk] = true;
        this.rows.push(__assign({}, row));
        return true;
    };
    Table.prototype.remove = function (primaryKey, conditional) {
        for (var i = 0; i < this.rows.length; i++) {
            if (this.rows[i].pk === primaryKey) {
                if (!conditional || matchesRecord(this.rows[i], conditional)) {
                    this.rows.splice(i, 1);
                    delete this.pks[primaryKey];
                    return true;
                }
                return false;
            }
        }
        return false;
    };
    return Table;
}());
/**
 * An in-memory version of the data store.  Not usable for anything except local testing.
 */
var MemoryDatabase = /** @class */ (function () {
    function MemoryDatabase() {
        this.tables = {};
    }
    // Method used by tests to get access to the underlying data.
    MemoryDatabase.prototype.testAccess = function (modelName) {
        return this.tables[modelName];
    };
    MemoryDatabase.prototype.updateSchema = function () {
        var _this = this;
        TABLES.forEach(function (modelName) {
            _this.tables[modelName] = new Table(modelName);
        });
        return Promise.resolve();
    };
    MemoryDatabase.prototype.conditionalUpdate = function (modelName, primaryKey, newValues, conditional) {
        var table = this.tables[modelName];
        if (!table) {
            return Promise.reject(new Error("unknown model name " + modelName));
        }
        var nv = newValues;
        var matches = table.matches(primaryKey, conditional);
        matches.forEach(function (row) {
            // Ignore the read-only aspects, and any model restrictions...
            var r = row;
            Object.keys(newValues).forEach(function (key) {
                if (key !== 'pk') {
                    r[key] = nv[key];
                }
            });
        });
        return Promise.resolve(matches.length);
    };
    MemoryDatabase.prototype.create = function (modelName, values) {
        var table = this.tables[modelName];
        if (!table) {
            return Promise.reject(new errors.NoSuchModelError(modelName));
        }
        if (!table.add(values)) {
            return Promise.reject(new errors.DuplicatePrimaryKeyError(modelName, values.pk));
        }
        return Promise.resolve();
    };
    MemoryDatabase.prototype.find = function (modelName, startIndex, maximumRecordCount, conditional) {
        var table = this.tables[modelName];
        if (!table) {
            return Promise.reject(new errors.NoSuchModelError(modelName));
        }
        // Need to split this up into separate calls.
        var allMatches = table.matches(null, conditional);
        allMatches.splice(0, startIndex);
        allMatches.splice(maximumRecordCount);
        return Promise.resolve(allMatches);
    };
    MemoryDatabase.prototype.remove = function (modelName, primaryKey, conditional) {
        var table = this.tables[modelName];
        if (!table) {
            return Promise.reject(new errors.NoSuchModelError(modelName));
        }
        return Promise.resolve(table.remove(primaryKey, conditional) ? 1 : 0);
    };
    return MemoryDatabase;
}());
exports.MemoryDatabase = MemoryDatabase;

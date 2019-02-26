"use strict";
exports.__esModule = true;
var EqualsConditional = /** @class */ (function () {
    function EqualsConditional(key, value) {
        this.key = key;
        this.value = value;
        this.type = 'eq';
    }
    return EqualsConditional;
}());
exports.EqualsConditional = EqualsConditional;
function isEqualsConditional(v) {
    return (!!v) && v.type === 'eq';
}
exports.isEqualsConditional = isEqualsConditional;
var AfterDateConditional = /** @class */ (function () {
    function AfterDateConditional(key, 
    // Date value is in UTC.
    after) {
        this.key = key;
        this.after = after;
        this.type = '>date';
    }
    return AfterDateConditional;
}());
exports.AfterDateConditional = AfterDateConditional;
function isAfterDateConditional(v) {
    return (!!v) && v.type === '>date';
}
exports.isAfterDateConditional = isAfterDateConditional;
var BeforeDateConditional = /** @class */ (function () {
    function BeforeDateConditional(key, 
    // Date value is in UTC.
    before) {
        this.key = key;
        this.before = before;
        this.type = '<date';
    }
    return BeforeDateConditional;
}());
exports.BeforeDateConditional = BeforeDateConditional;
function isBeforeDateConditional(v) {
    return (!!v) && v.type === '<date';
}
exports.isBeforeDateConditional = isBeforeDateConditional;
var OneOfConditional = /** @class */ (function () {
    function OneOfConditional(key, values) {
        this.key = key;
        this.values = values;
        this.type = 'in';
    }
    return OneOfConditional;
}());
exports.OneOfConditional = OneOfConditional;
function isOneOfConditional(v) {
    return (!!v) && v.type === 'in';
}
exports.isOneOfConditional = isOneOfConditional;
var OrConditional = /** @class */ (function () {
    function OrConditional(conditionals) {
        this.conditionals = conditionals;
        this.type = 'or';
    }
    return OrConditional;
}());
exports.OrConditional = OrConditional;
function isOrConditional(v) {
    return (!!v) && v.type === 'or';
}
exports.isOrConditional = isOrConditional;
var AndConditional = /** @class */ (function () {
    function AndConditional(conditionals) {
        this.conditionals = conditionals;
        this.type = 'and';
    }
    return AndConditional;
}());
exports.AndConditional = AndConditional;
function isAndConditional(v) {
    return (!!v) && v.type === 'and';
}
exports.isAndConditional = isAndConditional;

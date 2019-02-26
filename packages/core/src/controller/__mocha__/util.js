"use strict";
exports.__esModule = true;
var model_1 = require("../../model");
var ImmediateLeaseBehavior = /** @class */ (function () {
    function ImmediateLeaseBehavior(leaseTimeSeconds, retrySecondsDelay, leaseOwnerStrategy) {
        this.leaseTimeSeconds = leaseTimeSeconds;
        this.retrySecondsDelay = retrySecondsDelay;
        this.leaseOwnerStrategy = leaseOwnerStrategy;
    }
    ImmediateLeaseBehavior.prototype.registerRetryCallback = function (_, callback) {
        // ignore the delay seconds.
        setImmediate(callback);
    };
    return ImmediateLeaseBehavior;
}());
exports.ImmediateLeaseBehavior = ImmediateLeaseBehavior;
function createStaticPKStrategy(id) {
    return function () { return id; };
}
exports.createStaticPKStrategy = createStaticPKStrategy;
function getRow(store, modelName, pk) {
    var table = store.testAccess(modelName);
    if (!table) {
        throw new Error("no table registered named " + modelName);
    }
    return (table.rows.filter(function (r) { return r.pk === pk; })[0]);
}
exports.getRow = getRow;
function setLockState(store, pk, leaseOwner, leaseState, leaseExpires) {
    // Cast row to any to allow writes
    var row = getRow(store, model_1.SCHEDULE_MODEL_NAME, pk);
    var arow = row;
    arow.leaseOwner = leaseOwner;
    arow.leaseState = leaseState;
    arow.leaseExpires = leaseExpires;
    return row;
}
exports.setLockState = setLockState;
var BlockingPromise = /** @class */ (function () {
    function BlockingPromise() {
        var _this = this;
        this.innerResolve = null;
        this.innerReject = null;
        this.p = new Promise(function (res, rej) {
            _this.innerReject = rej;
            _this.innerResolve = res;
        });
    }
    /**
     * After "next" finishes running (then), the inner promise
     * is resolved, then the returned promise's "then()" is run.
     *
     * @param value
     * @param next
     */
    BlockingPromise.prototype.resolveAfter = function (value, next) {
        var _this = this;
        return next.then(function (x) {
            return new Promise(function (resolve, reject) {
                var tryComplete = function () {
                    if (!_this.innerResolve) {
                        setImmediate(tryComplete);
                    }
                    else {
                        _this.innerResolve(value);
                        resolve(x);
                    }
                };
                tryComplete();
            });
        });
    };
    BlockingPromise.prototype.rejectAfter = function (reason, next) {
        var _this = this;
        return next.then(function (x) {
            return new Promise(function (resolve, reject) {
                var tryComplete = function () {
                    if (!_this.innerReject) {
                        setImmediate(tryComplete);
                    }
                    else {
                        _this.innerReject(reason);
                        resolve(x);
                    }
                };
                tryComplete();
            });
        });
    };
    return BlockingPromise;
}());
exports.BlockingPromise = BlockingPromise;

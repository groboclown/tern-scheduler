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
var LeaseError = /** @class */ (function (_super) {
    __extends(LeaseError, _super);
    function LeaseError(ourLeaseId, job, leaseOwner, leaseExpires, message) {
        var _this = _super.call(this, message + "; currently owned by " + leaseOwner + " expires " + leaseExpires) || this;
        _this.ourLeaseId = ourLeaseId;
        _this.job = job;
        _this.leaseOwner = leaseOwner;
        _this.leaseExpires = leaseExpires;
        // Error workaround fun
        _this.name = LeaseError.name;
        Object.setPrototypeOf(_this, LeaseError.prototype);
        return _this;
    }
    return LeaseError;
}(base_1.TernError));
exports.LeaseError = LeaseError;
var LeaseNotObtainedError = /** @class */ (function (_super) {
    __extends(LeaseNotObtainedError, _super);
    function LeaseNotObtainedError(ourLeaseId, job, leaseOwner, leaseExpires) {
        var _this = _super.call(this, ourLeaseId, job, leaseOwner, leaseExpires, "Could not obtain lease for " + ourLeaseId + " against job " + job.pk) || this;
        // Error workaround fun
        _this.name = LeaseNotObtainedError.name;
        Object.setPrototypeOf(_this, LeaseNotObtainedError.prototype);
        return _this;
    }
    return LeaseNotObtainedError;
}(LeaseError));
exports.LeaseNotObtainedError = LeaseNotObtainedError;
var LeaseNotOwnedError = /** @class */ (function (_super) {
    __extends(LeaseNotOwnedError, _super);
    function LeaseNotOwnedError(ourLeaseId, job, leaseOwner, leaseExpires) {
        var _this = _super.call(this, ourLeaseId, job, leaseOwner, leaseExpires, "Lease not currently owned for " + ourLeaseId + " against job " + job.pk) || this;
        // Error workaround fun
        _this.name = LeaseNotOwnedError.name;
        Object.setPrototypeOf(_this, LeaseNotOwnedError.prototype);
        return _this;
    }
    return LeaseNotOwnedError;
}(LeaseError));
exports.LeaseNotOwnedError = LeaseNotOwnedError;
var LeaseExpiredError = /** @class */ (function (_super) {
    __extends(LeaseExpiredError, _super);
    function LeaseExpiredError(ourLeaseId, job, leaseOwner, leaseExpires) {
        var _this = _super.call(this, ourLeaseId, job, leaseOwner, leaseExpires, "Could not release lease for " + ourLeaseId + " against job " + job.pk + " due to another operation stole the lease because it was expired") || this;
        // Error workaround fun
        _this.name = LeaseExpiredError.name;
        Object.setPrototypeOf(_this, LeaseExpiredError.prototype);
        return _this;
    }
    return LeaseExpiredError;
}(LeaseError));
exports.LeaseExpiredError = LeaseExpiredError;
var ScheduledJobNotFoundError = /** @class */ (function (_super) {
    __extends(ScheduledJobNotFoundError, _super);
    function ScheduledJobNotFoundError(jobPk) {
        var _this = _super.call(this, "No such scheduled job " + jobPk) || this;
        _this.jobPk = jobPk;
        // Error workaround fun
        _this.name = ScheduledJobNotFoundError.name;
        Object.setPrototypeOf(_this, ScheduledJobNotFoundError.prototype);
        return _this;
    }
    return ScheduledJobNotFoundError;
}(base_1.TernError));
exports.ScheduledJobNotFoundError = ScheduledJobNotFoundError;
var TaskNotFoundError = /** @class */ (function (_super) {
    __extends(TaskNotFoundError, _super);
    function TaskNotFoundError(taskPk) {
        var _this = _super.call(this, "No such task " + taskPk) || this;
        _this.taskPk = taskPk;
        // Error workaround fun
        _this.name = TaskNotFoundError.name;
        Object.setPrototypeOf(_this, TaskNotFoundError.prototype);
        return _this;
    }
    return TaskNotFoundError;
}(base_1.TernError));
exports.TaskNotFoundError = TaskNotFoundError;
var InvalidTaskStateError = /** @class */ (function (_super) {
    __extends(InvalidTaskStateError, _super);
    function InvalidTaskStateError(task, newState, expectedState) {
        var _this = _super.call(this, "Could not update task " + task.pk + " to state " + newState + ": expected existing state " + expectedState + ", found " + task.state) || this;
        _this.task = task;
        _this.newState = newState;
        _this.expectedState = expectedState;
        // Error workaround fun
        _this.name = InvalidTaskStateError.name;
        Object.setPrototypeOf(_this, InvalidTaskStateError.prototype);
        return _this;
    }
    return InvalidTaskStateError;
}(base_1.TernError));
exports.InvalidTaskStateError = InvalidTaskStateError;

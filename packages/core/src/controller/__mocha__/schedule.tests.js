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
var chai_1 = require("chai");
var memory_1 = require("../../datastore/memory");
var db_impl_1 = require("../../datastore/db-impl");
var schedule_1 = require("../../model/schedule");
var schedule_2 = require("../schedule");
var util_1 = require("./util");
var errors_1 = require("../../errors");
var expect = chai_1["default"].expect;
var fail = chai_1["default"].assert.fail;
describe('schedule controller', function () {
    var now = new Date();
    var leaseTime = 10;
    var expires = new Date(now.valueOf());
    expires.setSeconds(expires.getSeconds() + leaseTime);
    var createdPk = 'pk1';
    var pkStrat = util_1.createStaticPKStrategy(createdPk);
    var createOwner = 'owner1';
    var createOwnerStrat = function () { return createOwner; };
    var leaseBehavior = new util_1.ImmediateLeaseBehavior(leaseTime, [1, 2, 3], createOwnerStrat);
    var requestedJob = {
        displayName: 'schedule name',
        description: 'schedule description',
        duplicateStrategy: '???',
        jobName: 'job name',
        jobContext: 'job context',
        scheduleDefinition: 'xyz',
        taskCreationStrategy: 'abc',
        retryStrategy: 'x'
    };
    var expectedCreatedJob = __assign({}, requestedJob, { leaseExpires: null, leaseOwner: null, state: schedule_1.SCHEDULE_STATE_ACTIVE, createdOn: now, pk: createdPk });
    describe('#createScheduledJob', function () {
        describe('When the db is connected', function () {
            it('is created just fine', function () {
                var db = new memory_1.MemoryDatabase();
                var store = new db_impl_1.DatabaseDataStore(db);
                // updateSchema returns a promise, but it it's only for API compliance, and the schema is created immediately.
                store.updateSchema();
                return schedule_2.createScheduledJobAlone(store, requestedJob, now, leaseBehavior, pkStrat, function (job) { return Promise.resolve({ value: job.pk }); })
                    .then(function (pk) {
                    var schedTable = db.testAccess(schedule_1.SCHEDULE_MODEL_NAME);
                    expect(schedTable).to.exist;
                    if (!schedTable) {
                        return;
                    }
                    expect(schedTable.rows).to.have.lengthOf(1);
                    expect(schedTable.rows[0]).to.deep.equal(expectedCreatedJob);
                });
            });
        });
        describe('When the DataStore has a problem', function () {
            it('reports the datastore error itself', function () {
                var db = new memory_1.MemoryDatabase();
                var store = new db_impl_1.DatabaseDataStore(db);
                var err = new Error('db err');
                store.addScheduledJobModel = function () {
                    return Promise.reject(err);
                };
                return schedule_2.createScheduledJobAlone(store, requestedJob, now, leaseBehavior, pkStrat, function (job) { return Promise.resolve(job.pk); })
                    .then(function () { fail("did not throw error"); })["catch"](function (e) {
                    expect(e).to.equal(err);
                    // No point in checking if it exists in the store, since we
                    // mocked up what the store does.
                    return Promise.resolve();
                });
            });
        });
    });
    describe('#runUpdateInLease', function () {
        describe('When a normal lease is attempted', function () {
            it('returns the update result', function () {
                var db = new memory_1.MemoryDatabase();
                var store = new db_impl_1.DatabaseDataStore(db);
                store.updateSchema();
                return schedule_2.createScheduledJobAlone(store, requestedJob, now, leaseBehavior, pkStrat, function (job) { return Promise.resolve(job.pk); })
                    .then(function (pk) {
                    expect(pk).to.equal(createdPk);
                    // Force an unlock of the job
                    util_1.setLockState(db, pk, null, schedule_1.SCHEDULE_STATE_ACTIVE, null);
                    return pk;
                })
                    .then(function (pk) { return schedule_2.runUpdateInLease(store, pk, now, leaseBehavior, function (jobB) {
                    var job = jobB;
                    // Expect the record to be leased.
                    expect(job.pk).to.equal(pk);
                    expect(job.leaseOwner).to.equal(createOwner);
                    expect(job.state).to.equal(schedule_1.SCHEDULE_STATE_UPDATING);
                    var table = db.testAccess(schedule_1.SCHEDULE_MODEL_NAME);
                    expect(table).to.exist;
                    if (!table) {
                        return Promise.reject();
                    }
                    expect(table.rows).to.have.lengthOf(1);
                    var row = (table.rows[0]);
                    expect(row.pk).to.equal(pk);
                    expect(row.leaseOwner).to.equal(createOwner);
                    expect(row.state).to.equal(schedule_1.SCHEDULE_STATE_UPDATING);
                    return Promise.resolve('xyz');
                }); })
                    .then(function (res) {
                    expect(res).to.equal('xyz');
                    // Expect the record to not be leased
                    var table = db.testAccess(schedule_1.SCHEDULE_MODEL_NAME);
                    expect(table).to.exist;
                    if (!table) {
                        return;
                    }
                    expect(table.rows).to.have.lengthOf(1);
                    var row = (table.rows[0]);
                    expect(row.leaseOwner).to.be["null"];
                    expect(row.state).to.equal(schedule_1.SCHEDULE_STATE_ACTIVE);
                });
            });
        });
        describe('When the lease is taken out from under the update', function () {
            it('reports lease not owned error', function () {
                var db = new memory_1.MemoryDatabase();
                var store = new db_impl_1.DatabaseDataStore(db);
                var owner2 = 'owner2';
                var leaseBehavior = new util_1.ImmediateLeaseBehavior(10, [], createOwnerStrat);
                var now = new Date();
                store.updateSchema();
                return schedule_2.createScheduledJobAlone(store, requestedJob, now, leaseBehavior, pkStrat, function (job) { return Promise.resolve(job.pk); })
                    .then(function (pk) {
                    expect(pk).to.equal(createdPk);
                    // Force an unlock of the job
                    util_1.setLockState(db, pk, null, schedule_1.SCHEDULE_STATE_ACTIVE, null);
                    return pk;
                })
                    .then(function (pk) { return schedule_2.runUpdateInLease(store, pk, now, leaseBehavior, function (job) {
                    var table = db.testAccess(schedule_1.SCHEDULE_MODEL_NAME);
                    expect(table).to.exist;
                    if (!table) {
                        return Promise.reject();
                    }
                    expect(table.rows).to.have.lengthOf(1);
                    // Set the real object's owner to a different one.
                    var row = (table.rows[0]);
                    row.leaseOwner = owner2;
                    return Promise.resolve();
                }); })
                    .then(function (res) { fail("should have failed with not lease owner"); })["catch"](function (e) {
                    expect(e).to.be.instanceOf(errors_1.LeaseNotOwnedError);
                    // Swtich to a success!
                    return Promise.resolve();
                });
            });
        });
    });
});

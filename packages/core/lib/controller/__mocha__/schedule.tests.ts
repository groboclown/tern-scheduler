
import chai from 'chai'
import sinon from 'sinon'

import {
  MemoryDatabase,
} from '../../datastore/memory'
import {
  DatabaseDataStore,
} from '../../datastore/db-impl'
import {
  ScheduledJobModel,
  ScheduleUpdateStateType,
  SCHEDULE_STATE_START_TASK,
  SCHEDULE_STATE_PASTURE,
} from '../../model/schedule'
import {
  NewScheduledJob,
  createScheduledJobAlone,
  runUpdateInLease,
} from '../schedule'
import {
  ImmediateLeaseBehavior,
  createStaticPKStrategy,
  setLockState,
  MessagingSpy,
} from './util'
import {
  LeaseNotOwnedError,
} from '../../errors'
import { ScheduledJobDataModel } from '../../datastore/db-api'
import { PrimaryKeyType } from '../../model';
const expect = chai.expect
const fail = chai.assert.fail


describe('schedule controller', () => {
  const now = new Date()
  const leaseTime = 10
  const expires = new Date(now.valueOf())
  expires.setSeconds(expires.getSeconds() + leaseTime)
  const createdPk = 'pk1'
  const pkStrat = createStaticPKStrategy(createdPk)
  const createOwner = 'owner1'
  const createOwnerStrat = () => createOwner
  const leaseBehavior = new ImmediateLeaseBehavior(leaseTime, [1, 2, 3], createOwnerStrat)
  const requestedJob: NewScheduledJob = {
    displayName: 'schedule name',
    description: 'schedule description',
    duplicateStrategy: '???',
    jobName: 'job name',
    jobContext: 'job context',
    scheduleDefinition: 'xyz',
    taskCreationStrategy: 'abc',
    retryStrategy: 'x'
  }
  function mkExpectedCreatedJob(args: {
    updateState: ScheduleUpdateStateType | null,
    updateTaskPk?: PrimaryKeyType,
    pasture?: boolean
  }): ScheduledJobDataModel {
    return {
      ...requestedJob,
      leaseExpires: null,
      leaseOwner: null,
      updateState: args.updateState,
      createdOn: now,
      pk: createdPk,
      updateTaskPk: args.updateTaskPk || null,
      pasture: args.pasture === true,
      previousSchedule: null,
      previousReason: null,
    }
  }
  describe('#createScheduledJob', () => {
    describe('When the db is connected', () => {
      it('is created just fine', () => {
        const db = new MemoryDatabase()
        const store = new DatabaseDataStore(db)
        const mSpy = new MessagingSpy()
        // updateSchema returns a promise, but it it's only for API compliance, and the schema is created immediately.
        store.updateSchema()
        return createScheduledJobAlone(store, requestedJob, now, leaseBehavior, pkStrat, mSpy.messaging, (job) => Promise.resolve({ value: job.pk }))
          .then(pk => {
            sinon.assert.notCalled(mSpy.generalError)
            expect(db.scheduledJobTable.rows).to.have.lengthOf(1)
            expect(db.scheduledJobTable.rows[0]).to.deep.equal(mkExpectedCreatedJob({ updateState: null }))
          })
      })
    })
    describe('When the DataStore has a problem', () => {
      it('reports the datastore error itself', () => {
        const db = new MemoryDatabase()
        const store = new DatabaseDataStore(db)
        const mSpy = new MessagingSpy()
        const err = new Error('db err')
        store.addScheduledJobModel = () => {
          return Promise.reject(err)
        }
        return createScheduledJobAlone(store, requestedJob, now, leaseBehavior, pkStrat, mSpy.messaging, (job) => Promise.resolve({ value: job.pk }))
          .then(() => { fail(`did not throw error`) })
          .catch(e => {
            expect(e).to.equal(err)
            // No point in checking if it exists in the store, since we
            // mocked up what the store does.
            return Promise.resolve()
          })
      })
    })
  })

  describe('#runUpdateInLease', () => {
    describe('When a normal lease is attempted', () => {
      it('returns the update result', () => {
        const db = new MemoryDatabase()
        const store = new DatabaseDataStore(db)
        const mSpy = new MessagingSpy()
        const createTaskPk = 'taskPk1'
        store.updateSchema()
        return createScheduledJobAlone(store, requestedJob, now, leaseBehavior, pkStrat, mSpy.messaging, (job) => Promise.resolve({ value: job.pk }))
          .then(pk => {
            sinon.assert.notCalled(mSpy.generalError)
            expect(pk).to.equal(createdPk)
            // Force an unlock of the job
            setLockState(db, pk, null, null, null)
            return pk
          })
          .then(pk => runUpdateInLease(store, SCHEDULE_STATE_START_TASK, pk, createTaskPk, now, leaseBehavior, mSpy.messaging, (jobB) => {
            sinon.assert.notCalled(mSpy.generalError)
            const job = <ScheduledJobDataModel>jobB
            // Expect the record to be leased.
            expect(job.pk).to.equal(pk)
            expect(job.leaseOwner).to.equal(createOwner)
            expect(job.updateState).to.equal(SCHEDULE_STATE_START_TASK)
            expect(db.scheduledJobTable.rows).to.have.lengthOf(1)
            const row = db.scheduledJobTable.rows[0]
            expect(row.pk).to.equal(pk)
            expect(row.leaseOwner).to.equal(createOwner)
            expect(row.updateState).to.equal(SCHEDULE_STATE_START_TASK)
            return Promise.resolve({ value: 'xyz' })
          }))
          .then(res => {
            expect(res).to.equal('xyz')
            // Expect the record to not be leased
            expect(db.scheduledJobTable.rows).to.have.lengthOf(1)
            const row = <ScheduledJobDataModel>(db.scheduledJobTable.rows[0])
            expect(row.leaseOwner).to.be.null
            expect(row.updateState).to.be.null
          })
      })
    })
    describe('When the lease is taken out from under the update', () => {
      it('reports lease not owned error', () => {
        const db = new MemoryDatabase()
        const store = new DatabaseDataStore(db)
        const mSpy = new MessagingSpy()
        const owner2 = 'owner2'
        const leaseBehavior = new ImmediateLeaseBehavior(10, [], createOwnerStrat)
        const now = new Date()
        store.updateSchema()
        return createScheduledJobAlone(store, requestedJob, now, leaseBehavior, pkStrat, mSpy.messaging, (job) => Promise.resolve({ value: job.pk }))
          .then(pk => {
            sinon.assert.notCalled(mSpy.generalError)
            expect(pk).to.equal(createdPk)
            // Force an unlock of the job
            setLockState(db, pk, null, null, null)
            return pk
          })
          .then(pk => runUpdateInLease(store, SCHEDULE_STATE_PASTURE, pk, null, now, leaseBehavior, mSpy.messaging, (job) => {
            sinon.assert.notCalled(mSpy.generalError)
            expect(db.scheduledJobTable.rows).to.have.lengthOf(1)
            // Set the real object's owner to a different one.
            const row = <any>(<ScheduledJobModel>(db.scheduledJobTable.rows[0]))
            row.leaseOwner = owner2
            return Promise.resolve({ value: 1 })
          }))
          .then(res => { fail(`should have failed with not lease owner`) })
          .catch(e => {
            sinon.assert.notCalled(mSpy.generalError)
            expect(e).to.be.instanceOf(LeaseNotOwnedError)
            // Swtich to a success!
            return Promise.resolve()
          })
      })
    })
  })
})

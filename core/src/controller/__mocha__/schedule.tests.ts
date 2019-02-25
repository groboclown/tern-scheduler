
import sinon from 'sinon'
import chai from 'chai'
import { MemoryDatabase } from '../../datastore/memory'
import { DatabaseDataStore } from '../../datastore/db-impl'

import {
  ScheduledJobModel,
  SCHEDULE_MODEL_NAME,
  SCHEDULE_STATE_ACTIVE,
  SCHEDULE_STATE_UPDATING,
} from '../../model/schedule'
import {
  NewScheduledJob,
  createScheduledJob,
  runUpdateInLease,
} from '../schedule'
import {
  BlockingPromise,
  ImmediateLeaseBehavior,
  createStaticPKStrategy,
  getRow,
  setLockState,
} from './util'
import {
  LeaseNotOwnedError,
} from '../../errors'
import { ScheduledJobDataModel } from '../../datastore/db-api';
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
  const expectedCreatedJob: ScheduledJobDataModel = {
    ...requestedJob,
    leaseExpires: null,
    leaseOwner: null,
    state: SCHEDULE_STATE_ACTIVE,
    createdOn: now,
    lastTaskExecutionDate: null,
    pk: createdPk
  }
  describe('#createScheduledJob', () => {
    describe('When the db is connected', () => {
      it('is created just fine', () => {
        const db = new MemoryDatabase()
        const store = new DatabaseDataStore(db)
        // updateSchema returns a promise, but it it's only for API compliance, and the schema is created immediately.
        store.updateSchema()
        return createScheduledJob(store, requestedJob, now, leaseBehavior, pkStrat, (job) => Promise.resolve(job.pk))
          .then(pk => {
            const schedTable = db.testAccess(SCHEDULE_MODEL_NAME)
            expect(schedTable).to.exist
            if (!schedTable) {
              return
            }
            expect(schedTable.rows).to.have.lengthOf(1)
            expect(schedTable.rows[0]).to.deep.equal(expectedCreatedJob)
          })
      })
    })
    describe('When the DataStore has a problem', () => {
      it('reports the datastore error itself', () => {
        const db = new MemoryDatabase()
        const store = new DatabaseDataStore(db)
        const err = new Error('db err')
        store.addScheduledJobModel = () => {
          return Promise.reject(err)
        }
        return createScheduledJob(store, requestedJob, now, leaseBehavior, pkStrat, (job) => Promise.resolve(job.pk))
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
        store.updateSchema()
        return createScheduledJob(store, requestedJob, now, leaseBehavior, pkStrat, (job) => Promise.resolve(job.pk))
          .then(pk => {
            expect(pk).to.equal(createdPk)
            // Force an unlock of the job
            setLockState(db, pk, null, SCHEDULE_STATE_ACTIVE, null)
            return pk
          })
          .then(pk => runUpdateInLease(store, pk, now, leaseBehavior, (jobB) => {
            const job = <ScheduledJobDataModel>jobB
            // Expect the record to be leased.
            expect(job.pk).to.equal(pk)
            expect(job.leaseOwner).to.equal(createOwner)
            expect(job.state).to.equal(SCHEDULE_STATE_UPDATING)
            const table = db.testAccess(SCHEDULE_MODEL_NAME)
            expect(table).to.exist
            if (!table) {
              return Promise.reject()
            }
            expect(table.rows).to.have.lengthOf(1)
            const row = <ScheduledJobDataModel>(table.rows[0])
            expect(row.pk).to.equal(pk)
            expect(row.leaseOwner).to.equal(createOwner)
            expect(row.state).to.equal(SCHEDULE_STATE_UPDATING)
            return Promise.resolve('xyz')
          }))
          .then(res => {
            expect(res).to.equal('xyz')
            // Expect the record to not be leased
            const table = db.testAccess(SCHEDULE_MODEL_NAME)
            expect(table).to.exist
            if (!table) {
              return
            }
            expect(table.rows).to.have.lengthOf(1)
            const row = <ScheduledJobDataModel>(table.rows[0])
            expect(row.leaseOwner).to.be.null
            expect(row.state).to.equal(SCHEDULE_STATE_ACTIVE)
          })
      })
    })
    describe('When the lease is taken out from under the update', () => {
      it('reports lease not owned error', () => {
        const db = new MemoryDatabase()
        const store = new DatabaseDataStore(db)
        const owner2 = 'owner2'
        const leaseBehavior = new ImmediateLeaseBehavior(10, [], createOwnerStrat)
        const now = new Date()
        store.updateSchema()
        return createScheduledJob(store, requestedJob, now, leaseBehavior, pkStrat, (job) => Promise.resolve(job.pk))
          .then(pk => {
            expect(pk).to.equal(createdPk)
            // Force an unlock of the job
            setLockState(db, pk, null, SCHEDULE_STATE_ACTIVE, null)
            return pk
          })
          .then(pk => runUpdateInLease(store, pk, now, leaseBehavior, (job) => {
            const table = db.testAccess(SCHEDULE_MODEL_NAME)
            expect(table).to.exist
            if (!table) {
              return Promise.reject()
            }
            expect(table.rows).to.have.lengthOf(1)
            // Set the real object's owner to a different one.
            const row = <any>(<ScheduledJobModel>(table.rows[0]))
            row.leaseOwner = owner2
            return Promise.resolve()
          }))
          .then(res => { fail(`should have failed with not lease owner`) })
          .catch(e => {
            expect(e).to.be.instanceOf(LeaseNotOwnedError)
            // Swtich to a success!
            return Promise.resolve()
          })
      })
    })
  })
})

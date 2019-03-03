
import chai from 'chai'
import sinon from 'sinon'

import {
  MemoryDatabase,
} from '../../datastore/memory'
import {
  SCHEDULE_STATE_ADD_TASK,
} from '../../model/schedule'
import {
  TaskModel,
  TASK_STATE_PENDING
} from '../../model'
import {
  NewScheduledJob,
} from '../schedule'
import {
  createScheduledJob,
} from '../combined'
import {
  ImmediateLeaseBehavior,
  MessagingSpy,
  ProxyDataStore,
} from './util'
import { ScheduledJobDataModel } from '../../datastore/db-api'
import { CreatePrimaryKeyStrategy } from '../../strategies'
const expect = chai.expect


describe('combined', () => {
  const now = new Date()
  const leaseTime = 10
  const expires = new Date(now.valueOf())
  expires.setSeconds(expires.getSeconds() + leaseTime)
  const taskNow = new Date(now.valueOf())
  taskNow.setSeconds(taskNow.getSeconds() + 100)
  const createdPk1 = 'pk1'
  const createdPk2 = 'pk2'
  const createdPk3 = 'pk3'
  const createdPks = [createdPk1, createdPk2, createdPk3]
  function mkPkStrat(): CreatePrimaryKeyStrategy {
    let i = 0
    return () => createdPks[i++]
  }
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
  describe('#createScheduledJob', () => {
    it('Standard task creation with create once task', () => {
      // Inject a spy during task creation to ensure the new scheduled job is
      // leased.
      const db = new MemoryDatabase()
      const mSpy = new MessagingSpy()
      const genTask: TaskModel[] = []
      const store = new ProxyDataStore(db)
        .forward('addScheduledJobModel')
        .forward('releaseScheduledJobLease')
        .forward('addTask', (args) => {
          const task: TaskModel = args[0]
          expect(db.scheduledJobTable.rows).to.have.lengthOf(1)
          const row = <ScheduledJobDataModel>(db.scheduledJobTable.rows[0])
          expect(row.pk).to.equal(createdPk1)
          expect(row.leaseOwner).to.equal(createOwner)
          expect(row.updateState).to.equal(SCHEDULE_STATE_ADD_TASK)
          genTask.push(task)
        }, () => {
          expect(db.taskTable.rows).to.have.lengthOf(1)
          const row = db.taskTable.rows[0]
          expect(row.pk).to.equal(createdPk2)
          expect(row.state).to.equal(TASK_STATE_PENDING)
        })
      store.updateSchema()
      return createScheduledJob(store, requestedJob, leaseBehavior, now, mkPkStrat(),
        {
          register() { },
          get() {
            return {
              after: 'new',
              createFromNewSchedule: () => taskNow
            }
          }
        }, mSpy.messaging)
        .then(jobPk => {
          // See the note above about active/disabled state  with a one-shot job.
          expect(jobPk).to.equal(createdPk1)
          expect(db.scheduledJobTable.rows).to.have.lengthOf(1)
          const job = db.scheduledJobTable.rows[0]
          expect(job.updateState).to.be.null
          expect(genTask).to.have.lengthOf(1)
          sinon.assert.calledWithExactly(mSpy.taskCreated, genTask[0])
          expect(db.taskTable.rows).to.have.lengthOf(1)
        })
    })
  })

  describe('#startTask', () => {

  })

  describe('#taskFinished', () => {

  })

  describe('#disableSchedule', () => {

  })
})

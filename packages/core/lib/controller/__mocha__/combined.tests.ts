
import chai from 'chai'
import sinon from 'sinon'

import {
  MemoryDatabase,
} from '../../datastore/memory'
import {
  SCHEDULE_MODEL_NAME,
  SCHEDULE_STATE_UPDATING,
  SCHEDULE_STATE_ACTIVE,
} from '../../model/schedule'
import {
  TaskModel,
  TASK_MODEL_NAME,
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
        .forward('releaseScheduledJobLease', (args) => {
          const endState = args[2]
          // The task is created only once, but it needs to be in active state,
          // so that the task can be fired.  Disabled scheduled jobs means that
          // the pending tasks can't run.
          // Is this behavior we want?  Without it, it means leasing a disabled
          // scheduled job, which has implications on other aspects of the code,
          // such as removing a scheduled job.
          expect(endState).to.equal(SCHEDULE_STATE_ACTIVE)
        })
        .forward('addTask', (args) => {
          const task: TaskModel = args[0]
          const table = db.testAccess(SCHEDULE_MODEL_NAME)
          expect(table).to.exist
          if (!table) {
            return
          }
          expect(table.rows).to.have.lengthOf(1)
          const row = <ScheduledJobDataModel>(table.rows[0])
          expect(row.pk).to.equal(createdPk1)
          expect(row.leaseOwner).to.equal(createOwner)
          expect(row.state).to.equal(SCHEDULE_STATE_UPDATING)
          genTask.push(task)
        }, () => {
          const table = db.testAccess(TASK_MODEL_NAME)
          expect(table).to.exist
          if (!table) {
            return
          }
          expect(table.rows).to.have.lengthOf(1)
          const row = <TaskModel>(table.rows[0])
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
        .then(job => {
          // See the note above about active/disabled state  with a one-shot job.
          expect(job.state).to.equal(SCHEDULE_STATE_ACTIVE)
          expect(genTask).to.have.lengthOf(1)
          sinon.assert.calledWithExactly(mSpy.taskCreated, genTask[0])
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

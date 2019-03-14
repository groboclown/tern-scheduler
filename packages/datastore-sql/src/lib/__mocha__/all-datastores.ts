/* tslint:disable:no-console */
/* tslint:disable:no-unused-expression */

import chai from 'chai'
import {
  TernClient,
  JobExecutionEventEmitter,
  TernConfiguration,
  strategies,
  executor,
} from '@tern-scheduler/core'
import {
  Options,
  Sequelize,
} from 'sequelize'
import {
  createSqlDataStore
} from '../..'
const expect = chai.expect

export function standardDataStoreTests(options: Options): void {
  const sequelize = new Sequelize(options)
  const datastore = createSqlDataStore(sequelize, (sql, time) => {
    console.log(`${options.dialect}: [${sql}] took ${time} ms`)
  })

  before(() => sequelize.drop().then(() => datastore.updateSchema(), () => datastore.updateSchema()))
  // Don't clean up afterwards, to make debugging a bit easier.

  describe('Create a schedule + job', () => {
    it('With standard stuff', () => {
      const now = new Date()
      const config = new TernConfiguration({
        store: datastore,
        generatePollWaitTimesStrategy: () => [2],
        retryLeaseTimeStrategy: () => [2],
        currentTimeUTCStrategy: () => now,
        registerPollCallback: (_, callback) => { setImmediate(callback) },
      })
      config.strategies.taskCreationStrategyRegistry.register('tcs', {
        after: 'new',
        createFromNewSchedule: (onCreate: Date) => onCreate,
      } as strategies.TaskCreationStrategyAfterCreation)
      const executor2 = new TestJobExecutionManager()
      // TODO eventually we'll get to the executor and that level of stuff...
      expect(executor2).to.not.be.null
      const client = new TernClient(config)

      return client
        .createScheduledJob({
          displayName: 'j1',
          description: 'j1 desc',
          duplicateStrategy: 'ds',
          jobName: 'job1',
          jobContext: 'job1c',
          retryStrategy: 'rs',
          scheduleDefinition: 'sd',
          taskCreationStrategy: 'tcs',
        })
        .then((createdSchedulePk) =>
          datastore.getScheduledJob(createdSchedulePk)
        )
        .then((createdSchedule) => {
          expect(createdSchedule).to.not.be.null
          if (!createdSchedule) { return }
          expect(createdSchedule.displayName).to.equal('j1')
          // Need to check the valueOf, because some returned SQL stored date values
          // do not return an equivalent object.
          expect(createdSchedule.createdOn.valueOf()).to.equal(now.valueOf())
        })
    })
  })
}

interface JobInfo {
  taskId: string
  jobName: string
  context: string
}

class TestJobExecutionManager implements executor.JobExecutionManager {
  readonly createdJobs: JobInfo[] = []
  messaging!: JobExecutionEventEmitter | null
  withMessaging(messaging: JobExecutionEventEmitter): this {
    this.messaging = messaging
    return this
  }
  startJob: executor.StartJob = (taskId: string, jobName: string, context: string) => {
    this.createdJobs.push({ taskId, jobName, context })
    const execId = this.createdJobs.length.toString()
    this.messaging && this.messaging.emit('jobExecutionFinished', execId,
      { state: 'completed', result: context } as executor.JobExecutionStateCompleted)
    return Promise.resolve(
      { state: executor.EXECUTION_RUNNING, jobId: execId }
    )
  }
}

import chai from 'chai'
import { Sequelize } from 'sequelize-typescript'
import {
  TernClient,
  JobExecutionManager,
  JobExecutionEventEmitter,
  StartJob,
  JobExecutionStateCompleted,
  TernConfiguration,
  TaskCreationStrategyAfterCreation,
} from '@tern-scheduler/core'
import {
  createSqlDataStore
} from '../'
const expect = chai.expect

export function standardDataStoreTests(sequelize: Sequelize) {
  const datastore = createSqlDataStore(sequelize, (sql, time) => {
    console.log(`${sequelize.options.dialect}: [${sql}] took ${time} ms`)
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
        registerPollCallback: (_, callback) => { setImmediate(callback) }
      })
      config.strategies.taskCreationStrategyRegistry.register('tcs', <TaskCreationStrategyAfterCreation>{
        after: 'new',
        createFromNewSchedule: (onCreate: Date) => onCreate
      })
      const executor = new TestJobExecutionManager()
      // TODO eventually we'll get to the executor and that level of stuf...
      expect(executor).to.not.be.null
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
          taskCreationStrategy: 'tcs'
        })
        .then(createdSchedule => {
          expect(createdSchedule.displayName).to.equal('j1')
          expect(createdSchedule.createdOn).to.equal(now)
        })
    })
  })
}

class TestJobExecutionManager implements JobExecutionManager {
  readonly createdJobs: { taskId: string, jobName: string, context: string }[] = []
  messaging!: JobExecutionEventEmitter | null
  withMessaging(messaging: JobExecutionEventEmitter) {
    this.messaging = messaging
    return this
  }
  startJob: StartJob = (taskId: string, jobName: string, context: string) => {
    this.createdJobs.push({ taskId, jobName, context })
    const execId = this.createdJobs.length.toString()
    this.messaging && this.messaging.emit('jobExecutionFinished', execId,
      <JobExecutionStateCompleted>{ state: 'completed', result: context })
    return Promise.resolve(execId)
  }
}

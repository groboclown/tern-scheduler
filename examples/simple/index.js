// Example usage of the Tern scheduler.

const tern = require('@tern-scheduler/core');
const storage = require('./storage');

// --------------------------------------------------------------------------
// Set up the scheduler configuration.
// It uses a SQL database.  The setup requires setting the environment
// variable `TERN_DB` with semicolon separated key=value pairs.
// SQLite:
//     db=sqlite[;file=(filename)]
//   Uses SQLite with an optional file backing.  If not file is given,
//   then it uses an in-memory database.
// MySQL:
//     db=mysql;name=(database);user=(username);password=(password)[;host=hostname;port=port]
//   Uses a MySQL compatible database.  The default host is 'localhost' and
//   default port is '3306'.
// PostGreSQL
//     db=postgres;name=(database);user=(username);password=(password)[;host=hostname;port=port]
//   Uses a MySQL compatible database.  The default host is 'localhost' and
//   default port is '5432'.
// Microsoft SQL Server
//     db=mssql;name=(database);user=(username);password=(password)[;host=hostname;port=port]
//   Uses a MySQL compatible database.  The default host is 'localhost' and
//   default port is '1433'.
const pollingCallback = new tern.PollingCallback();
const config = new tern.TernConfiguration({
  // Your data store, based on your specific environment.
  store: storage.datastore,

  // Allows for different ways to poll for different actions.
  // However, here, we're saying that every instance waits 4 seconds, 5
  // seconds, then 2 seconds when polling, then loops to the beginning
  // again.
  generatePollWaitTimesStrategy: () => [4, 5, 2],

  // Defines how long to wait to retry if a lease is owned by another
  // process, and also how many times to retry.
  retryLeaseTimeStrategy: () => [5],

  // You can provide the time to allow the combined effort for
  // the datastore access + the job execution framework to fire a job.
  // Default is 300 seconds (5 minutes).
  leaseTimeSeconds: 10,

  // The background polling activity monitor and runner.
  pollingCallback
});

const client = new tern.TernClient(config);


// --------------------------------------------------------------------------
// Database Setup
// Schema must exist before anything else can run.
config.store.updateSchema()
  .then(() => Promise.all([

    // ----------------------------------------------------------------------
    // Use the client to idempotently setup the schedules.
    // This runs in a promise, and must run after the schema is
    // udpated, but can run independent of the scheduler startup.
    config.store.updateSchema()
      .then(() => client.getActiveScheduledJobs(null, 100))
      .then(sjPage => {
        // Just inspect the first page's results, because we *should*
        // have fewer than 100 scheduled jobs.
        const ret = [];
        const names = sjPage.page.map(sj => sj.displayName);
        SCHEDULES.forEach(schedule => {
          if (names.indexOf(schedule.displayName) < 0) {
            ret.push(client.createScheduledJob(schedule));
          }
        });
        return Promise.all(ret);
      })
      .then(() => {
        console.log(`Completed setup of scheduled jobs`);
      }),

    // ----------------------------------------------------------------------
    // Start the scheduler.  Run independent of the schedule setup, but must
    // be done after the schema update runs.
    new Promise((resolve) => {
      const scheduler = new tern.TernScheduler(config,
        // Custom job execution framework.
        {
          // Public API
          startJob: (taskId, jobName, context) => {
            return jobRunner(taskId, jobName, context, this._messaging);
          },
          withMessaging: (messaging) => {
            this._messaging = messaging;
          },

          // Internal stuff
          _messaging: null,
        });
      // The scheduler will wire up standard messages on its own,
      // but we need to configure it to poll for events, because
      // we don't have network-wide messaging setup.
      scheduler.pollScheduledJobsForExpiredLeases();
      scheduler.pollTaskReadyToExecute();
      scheduler.pollLongQueuedTasks(10);
      scheduler.pollLongExecutingTasks(10);

      resolve();
    }),

  ]))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });

// --------------------------------------------------------------------------
// Schedules
const SCHEDULES = [
  {
    displayName: '30 seconds',
    description: 'Fire on the 30 second mark of every minute',

    // Name of the job to run and the context for the job.
    // In this case, our job executor (below) uses the job name
    // to lookup the method to invoke from the JOB_RUNNER object.
    jobName: 'now',
    jobContext: 'The once every 30 seconds job.',

    // Use the built-in duplicate strategy "skip", which returns "skip"
    // every time a task is asked to start when it is already running,
    // which means we will only have at most 1 instance of any task
    // running at the same time.
    duplicateStrategy: 'skip',

    // Use the built-in retry strategy "none", which returns null
    // every time a failed task is asked to run again, which
    // means that all failed tasks will never retry their execution.
    retryStrategy: 'none',

    // Use the built-in "cron" scheduling strategy.
    taskCreationStrategy: 'cron',
    // Trigger on the 0 and 30 second mark of every minute, every hour, etc.
    scheduleDefinition: JSON.stringify(tern.strategies.cronToDefinition('0,30 * * * * *')),
  },
  {
    displayName: '2 minutes',
    description: 'Fire once every 2 minutes, at the 15 second mark',
    duplicateStrategy: 'skip',
    jobName: 'soon',
    jobContext: 'The once every 2 minutes job.',
    retryStrategy: 'none',
    taskCreationStrategy: 'cron',
    scheduleDefinition: JSON.stringify(tern.strategies.cronToDefinition('15 */2 * * * *')),
  },
  {
    displayName: 'every 10 seconds, on every 3rd minute',
    description: 'Every 10 seconds for only every 3rd minute, run for 15 seconds',
    duplicateStrategy: 'skip',
    // The "soon" job runs for 15 seconds, but this one runs once every 10
    // seconds.  That means there is a time when the job is running and another
    // is queued to run.  The duplicate strategy "skip" means that all
    // triggered tasks while the another is running are not run.
    //jobName: 'later',
    jobName: 'soon',
    jobContext: 'Duplicate Check Job',
    retryStrategy: 'none',
    taskCreationStrategy: 'cron',
    scheduleDefinition: JSON.stringify(tern.strategies.cronToDefinition('*/10 */3 * * * *')),
  },
]


// --------------------------------------------------------------------------
// Definition of the jobs we'll run.
const JOB_RUNNER = {
  now: (resolve) => {
    resolve('now');
  },
  nowFail: (_, reject) => {
    reject(new Error('failed'));
  },
  nowLongStartTime: (resolve) => {
    setTimeout(() => resolve('soon'), 200);
  },
  soon: (resolve) => {
    // 5 mintues from now
    setTimeout(() => resolve('soon'), 15 * 1000);
  },
  later: (resolve) => {
    // 5 mintues from now
    setTimeout(() => resolve('later'), 300 * 1000);
  },
  laterFail: (_, reject) => {
    setTimeout(() => reject(new Error('later')), 300 * 1000);
  },
  never: () => {
    // do not resolve the promise.
  },
};
function jobRunner(taskId, jobName, context, messaging) {
  // Use the taskId as the executionId.
  const execId = taskId;
  console.log(`Starting task ${taskId}: ${context}`);
  const realRunner = JOB_RUNNER[jobName];
  const p = new Promise(realRunner);
  if (jobName.startsWith('now')) {
    return p
      .then((v) => {
        console.log(`Task ${taskId} completed in-execution: ${v}`);
        return { state: tern.executor.EXECUTION_COMPLETED, result: v };
      })
      .catch((e) => {
        // Maybe include another fail state to allow for failed-to-start error?
        console.log(`Task ${taskId} failed in-execution`, e);
        return { state: tern.executor.EXECUTION_FAILED, result: e.message };
      });
  }
  // The promise completes later, so emit the right message later.
  p
    .then((res) => {
      console.log(`Completed task ${taskId}: ${res}`);
      if (messaging) {
        messaging.emit('jobExecutionFinished',
          execId,
          // Finish state.
          {
            state: 'completed',
            result: res,
          });
      }
    })
    .catch((e) => {
      console.log(`Failed task ${taskId}: ${e.message}`);
      if (messaging) {
        messaging.emit('jobExecutionFinished',
          execId,
          {
            state: 'failed',
            result: e.message,
          });
      }
    });
  console.log(`Launched task ${taskId}.  Waiting for it to finish before emitting a message.`);
  return Promise.resolve({ state: tern.executor.EXECUTION_RUNNING, jobId: execId });
}


// --------------------------------------------------------------------------
// Finished setup; promises are running.

console.log('Press <Ctrl-C> to stop the scheduler.');

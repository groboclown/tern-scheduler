// Example usage of the Tern scheduler.

const fs = require("fs")
const sequelize = require('sequelize');
const tern = require('@tern-scheduler/core');
const ternSql = require('@tern-scheduler/datastore-sql');
const storage = require('./storage');

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
const datastore = new sequelize.Sequelize(storage);
const pollingCallback = new tern.PollingCallback();
const config = new tern.TernConfiguration({
  // Your data store, based on your specific environment.
  store: ternSql.createSqlDataStore(datastore),

  // Allows for different ways to poll for different actions.
  generatePollWaitTimesStrategy: createMyGeneratePollWaitTimesStrategy(),

  // Defines how long to wait to retry if a lease is owned by another
  // process, and also how many times to retry.
  retryLeaseTimeStrategy: createMyLeaseRetryTimeInSecondsStrategy(),

  // You can provide the time to allow the combined effort for
  // the datastore access + the job execution framework to fire a job.
  // Default is 300 seconds (5 minutes).
  leaseTimeSeconds: 10,

  // The background polling activity monitor and runner.
  pollingCallback
});


// Use the client to idempotently setup the 2 schedules.
// We'll have one schedule fire on the 30 second mark of every minute, and one
// to fire once every two minutes.
// This runs in a promise, but can run independent of the rest of the startup;
// that is, we don't have to wait for this to finish.
const client = new tern.TernClient(config);
client.getActiveScheduledJobs(null, 100)
  .then(sjPage => {
    // Just inspect the first page's results.
    const ret = [];
    const names = sjPage.page.forEach(sj => sj.displayName);
    if (names.indexOf('30 seconds') < 0) {
      ret.push(client.createScheduledJob({
        displayName: '30 seconds',
        description: 'Fire on the 30 second mark of every minute',
        jobName: 'log',
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
        scheduleDefinition: '* * * * * 30',
      }));
    }
    if (name.indexOf('2 minutes') < 0) {
      ret.push(client.createScheduledJob({
        displayName: '2 minutes',
        description: 'Fire once every 2 minutes, at the 15 second mark',
        duplicateStrategy: 'skip',
        jobName: 'log',
        jobContext: 'The once every 2 minutes job.',
        retryStrategy: 'none',
        taskCreationStrategy: 'cron',
        scheduleDefinition: '* * * * */2 15',
      }));
    }
    return Promise.all(ret);
  })
  .then(() => {
    console.log(`Completed setup of scheduled jobs`);
  })
  .catch(e => {
    console.log('Problem creating scheduled jobs', e);
    process.exit(1);
  });

const scheduler = new TernScheduler(config,
  // Custom job execution framework.
  {
    // Public API
    startJob: (taskId, jobName, context) => {
      // Perform the execution entirely in-process.
      return new Promise((resolve, reject) => {
        console.log(`Ran task ${taskId}: ${context}`);
        if (this._messaging) {
          this._messaging.emit('jobExecutionFinished',
            // Job Execution ID, which we set to the task ID.
            taskId,
            // Finish state.
            {
              state: 'completed',
              result: 'success',
            });
        }
        // Use the task ID as the job execution ID.
        resolve(taskId);
      });
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

// Wait for the user to press "Enter"
console.log('Press <Enter> to stop the scheduler.');
const fd = fs.openSync("/dev/stdin", "rs")
const b = new Buffer(1024)
while (true) {
  const n = fs.readSync(process.stdin.fd, b, 0, b.length);
  if (!n) {
    fs.closeSync(fd);
    process.exit(0);
  }
}

  * Immediate - run the job right now.
  * A relative time in the future - "Run once 5 minutes from now."
  * A fixed time in the future - "Run once on Saturday the 10th."
  * Reoccurence.  Different kinds of repeated executions.  All of them can run with no end date, after a set number of occurrences, or on a specific date/time.
    * At a fixed interval - "Run every 5 minutes."
    * Since the last completion - "Run 5 minutes since the last success."
    * Cron style.  Note that some appointment style patterns match 1-for-1 with the cron style.
    * Appointment style.  A start time with a day recurrence pattern:
      * Daily
        * Every X days
        * Every weekday
      * Weekly
        * Recur every X weeks
        * Day(s) of the week to recur
      * Monthly
        * Every X day of every X months
        * The (1st, 2nd, 3rd, last) (day, weekday, weekend day, Monday, Tues, etc) of every X months (TODO)
      * Yearly
        * Recur every X years. (TODO)
        * On (month name) (day of month)
        * On the (1st, 2nd, 3rd, last) (day, weekday, weekend day, Monday, Tues, etc) of (month name).  (TODO)

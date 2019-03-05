/* tslint:disable:no-unused-expression */

import chai from 'chai'
import {
  cronToModel,
  convertToModel,
  ScheduleCronModel,
  nextCronTime
} from '../task-creation/cron'
import {
  toTimeStruct, TimeStruct,
} from '../../internal/time-util'
const expect = chai.expect


describe('cron', () => {
  describe('#convertToModel', () => {
    describe('with valid input', () => {
      describe('for single digit', () => {
        it('returns right value', () => {
          const ret = convertToModel('1', [1, 31])
          expect(ret).to.deep.equal([1])
        })
      })
      describe('for double digit', () => {
        it('returns right value', () => {
          const ret = convertToModel('21', [1, 31])
          expect(ret).to.deep.equal([21])
        })
      })
      describe('for normal range', () => {
        it('returns right value', () => {
          const ret = convertToModel('2-5', [1, 31])
          expect(ret).to.deep.equal([2, 3, 4, 5])
        })
      })
      describe('for reversed range', () => {
        it('returns right value', () => {
          const ret = convertToModel('5-2', [1, 31])
          expect(ret).to.deep.equal([2, 3, 4, 5])
        })
      })
      describe('for series', () => {
        it('returns right value', () => {
          const ret = convertToModel('1,5', [1, 31])
          expect(ret).to.deep.equal([1, 5])
        })
      })
      describe('for series and range (1)', () => {
        it('returns right value', () => {
          const ret = convertToModel('1,5,8-10', [1, 31])
          expect(ret).to.deep.equal([1, 5, 8, 9, 10])
        })
      })
      describe('for series and range (2)', () => {
        it('returns right value', () => {
          const ret = convertToModel('8-10,1,2', [1, 31])
          expect(ret).to.deep.equal([1, 2, 8, 9, 10])
        })
      })
      describe('for series and multiple ranges', () => {
        it('returns right value', () => {
          const ret = convertToModel('8-10,3-6', [1, 31])
          expect(ret).to.deep.equal([3, 4, 5, 6, 8, 9, 10])
        })
      })
      describe('for step', () => {
        it('returns right value', () => {
          const ret = convertToModel('1,2,4,5/2', [1, 31])
          expect(ret).to.deep.equal([2, 4])
        })
      })
      describe('for star', () => {
        it('returns right value', () => {
          const ret = convertToModel('*', [0, 3])
          expect(ret).to.deep.equal([0, 1, 2, 3])
        })
      })
      describe('for star and step', () => {
        it('returns right value', () => {
          const ret = convertToModel('*/3', [0, 5])
          expect(ret).to.deep.equal([0, 3])
        })
      })
    })
  })

  describe('#cronToModel', () => {
    describe('with valid input', () => {
      describe('for just single digits with second', () => {
        it('returns right model', () => {
          const ret = cronToModel('6 1 2 3 4 5')
          expect(ret).to.deep.equal({
            seconds: [6],
            minutes: [1],
            hours: [2],
            daysOfMonth: [3],
            months: [4],
            daysOfWeek: [5],
          } as ScheduleCronModel)
        })
      })
      describe('for no seconds', () => {
        it('returns right model', () => {
          const ret = cronToModel('1 2 3 4 5')
          expect(ret).to.deep.equal({
            seconds: rangeNumbers(0, 59),
            minutes: [1],
            hours: [2],
            daysOfMonth: [3],
            months: [4],
            daysOfWeek: [5],
          } as ScheduleCronModel)
        })
      })
      describe('with 0 and 7 in week day', () => {
        it('returns right model', () => {
          const ret = cronToModel('6 1 2 3 4 0,7')
          expect(ret).to.deep.equal({
            seconds: [6],
            minutes: [1],
            hours: [2],
            daysOfMonth: [3],
            months: [4],
            daysOfWeek: [0],
          } as ScheduleCronModel)
        })
      })
      describe('with too few values', () => {
        it('raises an error', () => {
          try {
            cronToModel('1 2 3 4')
            chai.assert.fail('Did not throw an error')
          } catch (e) {
            expect(e).to.be.instanceOf(Error)
          }
        })
      })
      describe('with too many values', () => {
        it('raises an error', () => {
          try {
            cronToModel('1 2 3 4 5 6 7')
            chai.assert.fail('Did not throw an error')
          } catch (e) {
            expect(e).to.be.instanceOf(Error)
          }
        })
      })
    })
  })

  describe('#nextCronTime', () => {
    describe('when can run right now, for UTC', () => {
      it('returns right now', () => {
        const now = new Date(2000, 0, 30, 0, 0, 0, 0)
        const model: ScheduleCronModel = {
          cronExpression: '',
          months: [1],
          daysOfMonth: [31],
          daysOfWeek: rangeNumbers(0, 6),
          hours: [0],
          minutes: [0],
          seconds: [0],
          utcOffsetMinutes: 0,
          startAfter: null,
          endBy: null,
        }
        const ret = toTimeStruct(nextCronTime(model, now))
        expect(ret).to.deep.equal({
          year: 2000,
          month: 1,
          day: 31,
          hours: 0,
          minutes: 0,
          seconds: 0,
          millis: 0,
        } as TimeStruct)
      })
    })
    describe('when can run at a future point, looping over each value, for UTC', () => {
      it('returns right now', () => {
        const now = new Date(2000, 11, 31, 23, 59, 58, 0)
        const model: ScheduleCronModel = {
          cronExpression: '',
          months: [1],
          daysOfMonth: [1],
          daysOfWeek: rangeNumbers(0, 6),
          hours: [0],
          minutes: [0],
          seconds: [0],
          utcOffsetMinutes: 0,
          startAfter: null,
          endBy: null,
        }
        const ret = toTimeStruct(nextCronTime(model, now))
        expect(ret).to.deep.equal({
          year: 2001,
          month: 1,
          day: 1,
          hours: 0,
          minutes: 0,
          seconds: 0,
          millis: 0,
        } as TimeStruct)
      })
    })
    describe('when can run at a future point, looping over each value, for CST', () => {
      it('returns the end of next year', () => {
        const now = new Date(2000, 11, 31, 23, 59, 58, 0)
        const model: ScheduleCronModel = {
          cronExpression: '',
          months: [1],
          daysOfMonth: [1],
          daysOfWeek: rangeNumbers(0, 6),
          hours: [0],
          minutes: [0],
          seconds: [0],
          utcOffsetMinutes: 360, // UTC-600,
          startAfter: null,
          endBy: null,
        }
        const ret = toTimeStruct(nextCronTime(model, now))
        expect(ret).to.deep.equal({
          // Next match is in 2002, but it jumps back due to timezone change.
          // This is an interesting problem here.  The match SHOULD be
          // January 1, 2001 (in just 2 seconds), but because "now" is UTC,
          // and the match is CST, it needs to roll all the way to the end of
          // the next year to match up.
          year: 2001,
          month: 12,
          day: 31,
          hours: 18,
          minutes: 0,
          seconds: 0,
          millis: 0,
        } as TimeStruct)
      })
    })
    describe('when the matcher will never match a real date', () => {
      it('returns null', () => {
        const now = new Date(2000, 11, 31, 23, 59, 58, 0)
        const model: ScheduleCronModel = {
          cronExpression: '',
          months: [2],
          daysOfMonth: [31],
          daysOfWeek: rangeNumbers(0, 6),
          hours: [0],
          minutes: [0],
          seconds: [0],
          utcOffsetMinutes: 0,
          startAfter: null,
          endBy: null,
        }
        const ret = toTimeStruct(nextCronTime(model, now))
        expect(ret).to.be.null
      })
    })
    describe('now is past the end-by date', () => {
      it('returns null', () => {
        const now = new Date(2000, 11, 31, 23, 59, 58, 0)
        const model: ScheduleCronModel = {
          cronExpression: '',
          months: [2],
          daysOfMonth: [31],
          daysOfWeek: rangeNumbers(0, 6),
          hours: [0],
          minutes: [0],
          seconds: [0],
          utcOffsetMinutes: 0,
          startAfter: null,
          // End date is "now", which is before any schedule
          // can run.
          endBy: now,
        }
        const ret = toTimeStruct(nextCronTime(model, now))
        expect(ret).to.be.null
      })
    })
    describe('rolled-over is past the end-by date', () => {
      it('returns null', () => {
        const now = new Date(2000, 0, 1, 0, 0, 0, 0)
        const end = new Date(2000, 11, 1, 0, 0, 0, 0)
        const model: ScheduleCronModel = {
          cronExpression: '',
          months: [12],
          daysOfMonth: [31],
          daysOfWeek: rangeNumbers(0, 6),
          hours: [0],
          minutes: [0],
          seconds: [0],
          utcOffsetMinutes: 0,
          startAfter: null,
          // End date is before the next match date.
          endBy: end,
        }
        const ret = toTimeStruct(nextCronTime(model, now))
        expect(ret).to.be.null
      })
    })
    describe('before the start time', () => {
      it('returns time after start', () => {
        const now = new Date(2000, 11, 31, 23, 59, 58, 0)
        const start = new Date(2002, 2, 10, 23, 59, 59, 10)
        const model: ScheduleCronModel = {
          cronExpression: '',
          months: [3],
          daysOfMonth: [11],
          daysOfWeek: rangeNumbers(0, 6),
          hours: [0],
          minutes: [0],
          seconds: [0],
          utcOffsetMinutes: 0,
          startAfter: start,
          endBy: null,
        }
        const ret = toTimeStruct(nextCronTime(model, now))
        expect(ret).to.deep.equal({
          year: 2002,
          month: 3,
          day: 11,
          hours: 0,
          minutes: 0,
          seconds: 0,
          millis: 0,
        } as TimeStruct)

      })
    })
  })


  function rangeNumbers(min: number, max: number): number[] {
    const ret: number[] = []
    for (let i = min; i <= max; i++) {
      ret.push(i)
    }
    return ret
  }
})

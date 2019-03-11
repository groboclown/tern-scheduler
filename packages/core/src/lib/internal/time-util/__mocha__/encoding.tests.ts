/* tslint:disable:no-unused-expression */
import chai from 'chai'
import {
  toTimeStruct,
  TimeStruct,
  isTimeStruct,
} from '../encoding'
const expect = chai.expect

describe('time-util/encoding', () => {
  describe('#toTimeStruct', () => {
    describe('with undefined value', () => {
      it('returns undefined', () => {
        expect(toTimeStruct(undefined)).to.be.undefined
      })
    })
    describe('with null value', () => {
      it('returns null', () => {
        expect(toTimeStruct(null)).to.be.null
      })
    })
    describe('with zero month', () => {
      it('returns correct month 1-based', () => {
        const ret = toTimeStruct(new Date(2000, 0, 1, 5, 2, 3, 4))
        expect(ret).to.deep.equal({
          millis: 4,
          seconds: 3,
          minutes: 2,
          hours: 5,
          day: 1,
          month: 1,
          year: 2000,
        } as TimeStruct)
      })
    })
  })

  describe('#isTimeStruct', () => {
    describe('with null value', () => {
      it('returns false', () => {
        expect(isTimeStruct(null)).to.be.false
      })
    })
    describe('with undefined value', () => {
      it('returns false', () => {
        expect(isTimeStruct(undefined)).to.be.false
      })
    })
    describe('with array value', () => {
      it('returns false', () => {
        expect(isTimeStruct([''])).to.be.false
      })
    })
    describe('with primitive value', () => {
      it('returns false', () => {
        expect(isTimeStruct(1)).to.be.false
      })
    })
    describe('with incorrect year value', () => {
      it('returns false', () => {
        expect(isTimeStruct({
          millis: 1,
          seconds: 1,
          minutes: 1,
          hours: 1,
          day: 1,
          month: 1,
          year: 'year',
        })).to.be.false
      })
    })
    describe('with valid but out-of-range values', () => {
      it('returns false', () => {
        expect(isTimeStruct({
          millis: -10,
          seconds: 100,
          minutes: 2090,
          hours: 25,
          day: 100,
          month: 13.93,
          year: 2,
        })).to.be.true
      })
    })
  })
})

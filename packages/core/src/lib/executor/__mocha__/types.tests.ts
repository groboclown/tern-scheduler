/* tslint:disable:no-unused-expression */

import chai from 'chai'
import {
  isJobExecutionStateCompleted,
  isJobExecutionStateFailed,
  isJobExecutionStateDidNotStart,
  isJobExecutionStateRunning,
  EXECUTION_COMPLETED,
  EXECUTION_DID_NOT_START,
  EXECUTION_FAILED,
  EXECUTION_RUNNING,
} from '../types'
const expect = chai.expect

describe('job executor api', () => {
  describe('#isJobExecutionStateCompleted', () => {
    it('matches', () => {
      const res = isJobExecutionStateCompleted({ state: EXECUTION_COMPLETED })
      expect(res).to.be.true
    })
    it('does not match', () => {
      const res = isJobExecutionStateCompleted({ state: 'blah' })
      expect(res).to.be.false
    })
  })
  describe('#isJobExecutionStateFailed', () => {
    it('matches', () => {
      const res = isJobExecutionStateFailed({ state: EXECUTION_FAILED })
      expect(res).to.be.true
    })
    it('does not match', () => {
      const res = isJobExecutionStateFailed({ state: 'blah' })
      expect(res).to.be.false
    })
  })
  describe('#isJobExecutionStateFailedToStart', () => {
    it('matches', () => {
      const res = isJobExecutionStateDidNotStart({ state: EXECUTION_DID_NOT_START })
      expect(res).to.be.true
    })
    it('does not match', () => {
      const res = isJobExecutionStateDidNotStart({ state: 'blah' })
      expect(res).to.be.false
    })
  })
  describe('#isJobExecutionStateRunning', () => {
    it('matches', () => {
      const res = isJobExecutionStateRunning({ state: EXECUTION_RUNNING })
      expect(res).to.be.true
    })
    it('does not match', () => {
      const res = isJobExecutionStateRunning({ state: 'blah' })
      expect(res).to.be.false
    })
  })
})

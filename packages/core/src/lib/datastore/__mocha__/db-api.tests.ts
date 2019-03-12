/* tslint:disable:no-unused-expression */

import chai from 'chai'
import * as dbapi from '../db-api'

const expect = chai.expect


describe('db-api', () => {
  describe('#isNullConditional', () => {
    it('has correct match', () => {
      const cnd = new dbapi.NullConditional('pk')
      expect(dbapi.isNullConditional(cnd)).to.be.true
    })
    it('has correct negative match', () => {
      const cnd = new dbapi.NotNullConditional('pk')
      expect(dbapi.isNullConditional(cnd)).to.be.false
    })
  })
})

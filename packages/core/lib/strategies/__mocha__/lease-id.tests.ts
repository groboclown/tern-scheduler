import chai from 'chai'
import { CreateLeaseIdStrategy, CreateLeaseIdStrategyRegistry } from '../lease-id/api'
import { addUUIDCreateLeaseIdStrategy } from '../lease-id'
import { UUID_LEASE_ID_STRAT_NAME } from '../lease-id/uuid'
const expect = chai.expect

describe('lease-id', () => {
  describe('#uuid', () => {
    describe('with different hostnames', () => {

    })

    describe('add strategy', () => {
      let registered: { [name: string]: CreateLeaseIdStrategy } = {}
      const reg: CreateLeaseIdStrategyRegistry = {
        register: (name: string, strat: CreateLeaseIdStrategy): void => {
          registered[name] = strat
        },
        get: (name: string) => {
          const ret = registered[name]
          if (!ret) throw new Error(`bad`)
          return ret
        }
      }

      it('with everything valid', () => {
        registered = {}
        addUUIDCreateLeaseIdStrategy(reg)
        const r = reg.get(UUID_LEASE_ID_STRAT_NAME)
        expect(r).not.to.be.null
        expect(r).not.to.be.undefined
        const v = r()
        // Example: cd8f5f9f-e3e8-569f-87ef-f03c6cfc29bc
        expect(v).to.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)
      })
    })
  })
})

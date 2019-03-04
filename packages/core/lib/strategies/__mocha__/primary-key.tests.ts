import chai from 'chai'
import { CreatePrimaryKeyStrategyRegistry, CreatePrimaryKeyStrategy } from '../primary-key/api'
import { addUUIDCreatePrimaryKeyStrategy } from '../primary-key'
import { UUID_PK_STRAT_NAME } from '../primary-key/uuid'
const expect = chai.expect

describe('primary-key', () => {
  describe('#uuid', () => {
    describe('with different hostnames', () => {

    })

    describe('add strategy', () => {
      let registered: { [name: string]: CreatePrimaryKeyStrategy } = {}
      const reg: CreatePrimaryKeyStrategyRegistry = {
        register: (name: string, strat: CreatePrimaryKeyStrategy): void => {
          registered[name] = strat
        },
        get: (name: string) => {
          const ret = registered[name]
          if (!ret) throw new Error(`bad`)
          return ret
        },
      }

      it('with everything valid', () => {
        registered = {}
        addUUIDCreatePrimaryKeyStrategy(reg)
        const r = reg.get(UUID_PK_STRAT_NAME)
        expect(r).not.to.be.null
        expect(r).not.to.be.undefined
        const v = r()
        // Example: cd8f5f9f-e3e8-569f-87ef-f03c6cfc29bc
        expect(v).to.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)
      })
    })
  })
})


import {
  StrategyNotRegisteredError
} from '../errors'

export type StrategyName = string

export interface StrategyRegistry<T> {
  /**
   * Register the strategy with the name.  If that strategy is already registered,
   * it is overwritten.
   *
   * @param name
   * @param strat
   */
  register(name: StrategyName, strat: T): void

  /**
   * Throws an exception if not found
   */
  get(name: StrategyName): T
}

export abstract class AbstractStrategyRegistry<T> implements StrategyRegistry<T> {
  private readonly registry: { [name: string]: T } = {}

  constructor(private readonly strategyType: string) { }

  abstract setupDefaultRegistration(): void

  register(name: StrategyName, strat: T): void {
    this.registry[name] = strat
  }


  // Throws an exception if not found
  get(name: StrategyName): T {
    const ret = this.registry[name]
    if (!ret) {
      throw new StrategyNotRegisteredError(this.strategyType, name)
    }
    return ret
  }
}

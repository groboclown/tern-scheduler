
import {
  TernError
} from './base'

export class StrategyNotRegisteredError extends TernError {
  constructor(strategyType: string, strategyName: string) {
    super(`Strategy ${strategyName} not registered as a ${strategyType}`)

    // Error workaround fun
    this.name = StrategyNotRegisteredError.name
    Object.setPrototypeOf(this, StrategyNotRegisteredError.prototype)
  }
}

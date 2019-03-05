
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

export class InvalidScheduleDefinitionError extends TernError {
  constructor(
    public readonly scheduledJobPk: string,
    public readonly strategyDefinition: string,
    public readonly problem: string
  ) {
    super(`Scheduled job ${scheduledJobPk} has invalid strategy definition (${problem}): ${strategyDefinition}`)

    // Error workaround fun
    this.name = StrategyNotRegisteredError.name
    Object.setPrototypeOf(this, StrategyNotRegisteredError.prototype)
  }
}

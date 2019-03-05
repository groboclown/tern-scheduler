import {
  CronModel,
} from './api'


const ALLOWED_RANGES: { [key: string]: [number, number] } = {
  seconds: [0, 59],
  minutes: [0, 59],
  hours: [0, 23],
  daysOfMonth: [1, 31],
  months: [1, 12],
  daysOfWeek: [0, 7],
}

/**
 * Convert a cron time expression (e.g. `0 *\/10 * * * *`) to the internal
 * range model.
 *
 * The ordering is:
 * 1. second (optional)
 * 1. minute
 * 1. hour
 * 1. day of month
 * 1. month
 * 1. day of week; 0 or 7 are Sunday
 *
 * The returned value isn't necessarily a valid model.  It doesn't guarantee that
 * there are enough values in each array.
 *
 * @param cronExpression
 */
export function cronToModel(cronExpression: string): CronModel {
  const parts = cronExpression.split(/\s+/g)
  if (parts.length === 5) {
    // Insert the missing seconds value.
    parts.splice(0, 0, '*')
  }
  if (parts.length !== 6) {
    throw new Error(`Invalid argument: cron expression must contain 5 or 6 values; found "${cronExpression}"`)
  }
  return {
    seconds: convertToModel(parts[0], ALLOWED_RANGES.seconds),
    minutes: convertToModel(parts[1], ALLOWED_RANGES.minutes),
    hours: convertToModel(parts[2], ALLOWED_RANGES.hours),
    daysOfMonth: convertToModel(parts[3], ALLOWED_RANGES.daysOfMonth),
    months: convertToModel(parts[4], ALLOWED_RANGES.months),
    daysOfWeek: handleSundays(convertToModel(parts[5], ALLOWED_RANGES.daysOfWeek)),
  }
}


/** Exported for test purposes only */
export function convertToModel(expr: string, range: [number, number]): number[] {
  return removeDuplicates(convertStep(convertRange(replaceAsteriskWithRange(expr, range))), range)
}


function replaceAsteriskWithRange(expr: string, range: [number, number]): string {
  const pos = expr.indexOf('*')
  if (pos >= 0) {
    expr = `${expr.substring(0, pos)}${range[0]}-${range[1]}${expr.substring(pos + 1)}`
  }
  return expr
}


/** convert range values (e.g. 1-12) into comma-separated numbers. */
function convertRange(expr: string): string {
  const matchExpr = /(\d+)\-(\d+)/
  let match = matchExpr.exec(expr)
  while (match !== null && match.length > 0) {
    let nx = expr.substring(0, match.index)
    let first = parseInt(match[1], 10)
    let last = parseInt(match[2], 10)
    if (first > last) {
      const t = last
      last = first
      first = t
    }
    for (let i = first; i <= last; i++) {
      nx += String(i)
      if (i !== last) {
        nx += ','
      }
    }
    expr = nx + expr.substring(match.index + match[0].length)
    match = matchExpr.exec(expr)
  }
  return expr
}

/** at this point the expression should just be numbers, commas, and at most one slash. */
function convertStep(expr: string): number[] {
  const ret: number[] = []
  const slashPos = expr.indexOf('/')
  let step = 1
  if (slashPos >= 0) {
    step = parseInt(expr.substring(slashPos + 1), 10)
  }

  expr.split(',').forEach((part) => {
    const v = 0 + parseInt(part, 10)
    if (v % step === 0) {
      ret.push(v)
    }
  })

  return ret
}


function removeDuplicates(vals: number[], range: [number, number]): number[] {
  const ret: number[] = []
  vals.forEach((v) => {
    if (v >= range[0] && v <= range[1] && ret.indexOf(v) < 0) {
      ret.push(v)
    }
  })
  // Note: we need a numeric sort; default is a string sort.
  return ret.sort((a, b) => (0 + a) - (0 + b))
}


function handleSundays(vals: number[]): number[] {
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === 7) {
      vals[i] = 0
    }
  }
  return removeDuplicates(vals, [0, 6])
}

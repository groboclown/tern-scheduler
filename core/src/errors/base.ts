

export class TernError extends Error {
  constructor(message: string) {
    super(message)

    // Error workaround fun
    this.name = TernError.name
    Object.setPrototypeOf(this, TernError.prototype)
  }
}


import uuid4 from 'uuid/v4'

export interface UUIDConfig {
  hostname: string
}

export function createUUIDProvider(config: UUIDConfig): (() => string) {
  return () => {
    const v4 = uuid4()
    // TODO look at modifying the value so that it uses the hostname from the
    // configuration.
    return v4
  }
}

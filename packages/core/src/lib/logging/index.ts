
export let DEBUG = false
export let INFO = true

// This file is allowed to have console logging, because that's the point of it.
/* tslint:disable:no-console */

export function logCriticalError(e: any): void {
  console.error('ERROR:', e)
}

export function logNotificationError(reasonIsJustNotify: string, e: any): void {
  console.log(`NOTE: ${reasonIsJustNotify}`, e)
}

export function logDebug(src: string, msg: string, e?: any): void {
  if (DEBUG) {
    if (!e) {
      console.log(`DEBUG: ${src} : ${msg}`)
    } else {
      console.log(`DEBUG: ${src} : ${msg}`, e)
    }
  }
}

export function logInfo(src: string, msg: string, e?: any): void {
  if (INFO) {
    if (!e) {
      console.log(`INFO: ${src} : ${msg}`)
    } else {
      console.log(`INFO: ${src} : ${msg}`, e)
    }
  }
}

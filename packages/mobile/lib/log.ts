import { isNetworkError } from '@splat-connect/types'

// Log a failed API call. Going offline is expected, not a bug, and in a dev
// build LogBox turns every console.error into a red screen the person must
// dismiss, so network failures stay out of console.error.
export function logFailure(tag: string, err: unknown): void {
  if (isNetworkError(err)) {
    console.debug(tag, err)
    return
  }
  console.error(tag, err)
}

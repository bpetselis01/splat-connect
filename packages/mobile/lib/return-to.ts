// Where to go once sign-in succeeds. A guest who taps "I'm going" on an event
// signs in and lands back on that event, not on Home. Held in memory: the
// sign-in screens are the same app run, so nothing needs to survive a restart.
let target: string | null = null

export const setReturnTo = (path: string) => {
  target = path
}

export function takeReturnTo(): string | null {
  const t = target
  target = null
  return t
}

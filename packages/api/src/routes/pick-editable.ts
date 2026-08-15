// Trust-boundary input filter: only whitelisted columns from a request body
// are copied through, so a client can't set server-owned columns (ids, owner
// fields, timestamps) by including them in the payload.
export function pickEditable(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in body) out[key] = body[key]
  }
  return out
}

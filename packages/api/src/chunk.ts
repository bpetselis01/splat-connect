/**
 * PostgREST turns `.in(col, ids)` into a URL query parameter, and the gateway
 * rejects the request outright once the URL passes ~8KB — "URI too long",
 * measured at 454 uuids and fine at 100. Any `.in()` fed a user-scaled id
 * list must be split through this and the results merged.
 */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Runs one `.in()` lookup per chunk of `ids` and merges the rows; the first error wins. */
export async function selectIn<R>(
  ids: string[],
  run: (ids: string[]) => PromiseLike<{ data: R[] | null; error: { message: string } | null }>,
): Promise<{ data: R[]; error: { message: string } | null }> {
  const results = await Promise.all(chunk(ids).map(run))
  return {
    data: results.flatMap((r) => r.data ?? []),
    error: results.find((r) => r.error)?.error ?? null,
  }
}

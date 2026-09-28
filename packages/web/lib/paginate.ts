/**
 * One page of a list the API returns whole. Every long list on the site —
 * the library's 878 guides, the impact page's 641 contributors, admin's
 * ~1000 accounts — rendered every row at every width, which on a phone is a
 * page hundreds of thousands of pixels tall.
 *
 * ponytail: slices after the API has sent everything; move the limit into
 * the endpoints (range headers) once payload size, not DOM size, is the cost.
 */
export function paginate<T>(items: T[], rawPage: string | undefined, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const asked = Number.parseInt(rawPage ?? '', 10)
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1
  return { items: items.slice((page - 1) * size, page * size), page, pages, total: items.length }
}

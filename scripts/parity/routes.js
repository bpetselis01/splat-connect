/**
 * Turn a screen-map entry into a concrete live URL. Shared by run.js (board
 * parity) and mobile.js (phone-width audit), which measure different things on
 * the same pages.
 */
const { dbSample } = require('./seed')

/**
 * Dynamic routes need a real record id. Scrape one off a list page rather than
 * querying the database: a scraped link is by construction a page the app
 * itself considers reachable and populated.
 *
 * Matched against the ROUTE TEMPLATE, not against the list page's own path.
 * Deriving the pattern from the list URL assumed the two share a prefix, and
 * across this app they frequently do not — guides are listed at /library but
 * detailed at /tutorials/[id], and /organizations lists links to
 * /organizations/[id]/public, two segments down. Nine screens went unmeasured
 * on that assumption.
 */
async function resolveDynamic(page, live, entry, cache) {
  const key = entry.route
  if (!cache.has(key)) {
    let found = null
    try {
      await page.goto(live + entry.sampleFrom, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page.waitForTimeout(600)
      const pattern =
        '^' +
        entry.route
          .split('/')
          .map((seg) =>
            /^\[.+\]$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          )
          .join('/') +
        '$'
      found = await page.evaluate((pat) => {
        const re = new RegExp(pat)
        // "new", "create" and friends are forms, not records. /dashboard/toys
        // links to /dashboard/toys/new, and scraping that made the harness
        // compare the board's toy DETAIL screen against live's add-a-toy form.
        const RESERVED = new Set(['new', 'create', 'add', 'edit', 'request'])
        return (
          [...document.querySelectorAll('a[href]')]
            .map((x) => new URL(x.href, location.origin).pathname)
            .find((p) => re.test(p) && !RESERVED.has(p.split('/').pop())) || null
        )
      }, pattern)
    } catch {
      /* falls through to null */
    }
    cache.set(key, found)
  }
  return cache.get(key)
}

/**
 * The route to load for `s`, or null when no fixture reaches it.
 * ctx: { page, live, seeded, cache, screens, allScreens, db }
 */
async function resolveRoute(s, ctx) {
  const { page, live, seeded, cache, screens, allScreens, db } = ctx
  if (!s.sampleFrom) return s.route
  // An explicit DB sample beats scraping: the first link on a list is
  // whichever fixture sorts first, and that is usually the emptiest.
  let route =
    seeded[s.id] || (await dbSample(db, s.id)) || (await resolveDynamic(page, live, s, cache))
  // Nested under a dynamic parent (/toy-library/[id]/request): the link
  // is on the parent's detail page, never on a list, so take the parent's
  // already-resolved route and append.
  //
  // `suffix` appends; a `[id]` in the route substitutes the parent's id
  // instead, which is the only way to reach a form that takes its record
  // in the query string. /printing/requests without ?guide= is the "every
  // request starts from a guide" banner, and the harness was comparing
  // that banner against the board's full request form: no inputs, two
  // missing sections and a gross height difference, all of them the
  // harness standing on the wrong page.
  if (!route && s.derivedFrom) {
    const parent =
      screens.find((x) => x.id === s.derivedFrom) || allScreens.find((x) => x.id === s.derivedFrom)
    if (parent) {
      const base =
        seeded[parent.id] ||
        cache.get(parent.route) ||
        (await resolveDynamic(page, live, parent, cache))
      // The parent's id sits where its template has [id] — not always last:
      // /organizations/[id]/public ends in "public".
      const at = parent.route.split('/').findIndex((seg) => /^\[.+\]$/.test(seg))
      if (base)
        route = s.route.includes('[id]')
          ? s.route.replace('[id]', base.split('/')[at])
          : base + s.suffix
    }
  }
  return route || null
}

module.exports = { resolveDynamic, resolveRoute }

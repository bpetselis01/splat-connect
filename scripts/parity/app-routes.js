/**
 * App routes for dynamic screens. The seed creates web-shaped routes keyed by
 * web screen id; an app row names the web screen whose record it shows
 * (`idFrom`) and takes that record's id into its own [param].
 */
const { dbSample } = require('./seed')
const { resolveDynamic } = require('./routes')

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/

function withId(route, webRoute) {
  const id = webRoute && UUID.exec(webRoute)?.[0]
  return id ? route.replace(/\[[^\]]+\]/, id) : null
}

/** ctx: { page, live, seeded, cache, db } as harness.js passes it. */
async function resolveAppRoute(s, ctx) {
  // A route the seed or a DB sample made for this app screen itself, under
  // `app:` so an app id that is also a web screen id (editor, toy_detail) never
  // takes the web route.
  const own = ctx.seeded[`app:${s.id}`] || (ctx.db && (await dbSample(ctx.db, `app:${s.id}`)))
  if (own) return own
  if (!/\[/.test(s.route)) return s.route
  const fromWeb = s.idFrom && withId(s.route, ctx.seeded[s.idFrom] || (await dbSample(ctx.db, s.idFrom)))
  if (fromWeb) return fromWeb
  // Scraping the app's own list needs a browser page; the picture pass has none.
  if (s.sampleFrom && ctx.page) return resolveDynamic(ctx.page, ctx.live, s, ctx.cache)
  return null
}

module.exports = { withId, resolveAppRoute }

// The journey map's rules: how tests declare coverage, what counts as a gap,
// and the doc rendered from both. check.mjs and render.mjs are thin CLIs.
import { parseTitles } from './titles.mjs'

export const LAYERS = {
  'web-unit': { glob: 'packages/web/tests/unit/**/*.test.{ts,tsx}', platform: 'web' },
  'web-e2e': { glob: 'packages/web/tests/e2e/**/*.spec.ts', platform: 'web' },
  'mobile-unit': { glob: 'packages/mobile/tests/unit/**/*.test.{ts,tsx}', platform: 'mobile' },
  'mobile-e2e': { glob: 'packages/mobile/tests/e2e/*.spec.ts', platform: 'mobile' },
  // integration only: unit tests mock Supabase and cannot prove a journey
  api: { glob: 'packages/api/tests/integration/**/*.test.ts' },
  device: { glob: 'packages/mobile/.maestro/flows/*.yaml' },
}
export const KINDS = ['static', 'nav', 'write']
const PLATFORMS = ['web', 'mobile']
const SEATS = ['anon', 'P', 'L', 'A']
const SETTERS = ['n/a', 'P', 'L', 'A', 'web', 'mobile', 'none']
const ID = /^W?[A-Z]\d{2}$/
const legalFor = (platform) => Object.entries(LAYERS).filter(([, l]) => !l.platform || l.platform === platform).map(([name]) => name)
const TAG = /^(?:\/\/|#)\s*journeys:\s*(.*)$/

export function parseTags(text) {
  const lines = text.split('\n').slice(0, 10)
  const hits = lines.map((l) => l.match(TAG)).filter(Boolean)
  const errors = []
  if (hits.length > 1) errors.push('more than one journeys: line')
  if (!hits.length) return { ids: [], errors }
  const raw = hits[0][1].trim()
  if (raw.startsWith('(')) {   // "(none — reason)" opt-out
    if (!/^\(\s*none\s*[—–:-]+\s*[^\s)][^)]*\)?$/.test(raw)) errors.push('opt-out needs a reason: (none — reason)')
    return { ids: [], errors }
  }
  const ids = raw.split(/\s+/).filter(Boolean)
  for (const id of ids) if (!/^[A-Z]\d{2}$/.test(id)) errors.push(`bad id ${id}`)
  if (new Set(ids).size !== ids.length) errors.push('duplicate id')
  return { ids, errors }
}

// Which ids a test file claims. Title ids always count; a file-level line counts only
// while the file is on the legacy list. Both together is malformed, but both still count so
// a half-migrated file reports one error, not a wave of false gaps.
export function fileClaims(file, text, legacy) {
  const kind = file.endsWith('.yaml') ? 'yaml' : 'ts'
  const titles = parseTitles(text, kind)
  const tags = parseTags(text)
  const errors = [...titles.errors, ...tags.errors]
  const fileLevel = tags.ids.length > 0
  if (fileLevel && titles.ids.length) errors.push('remove the file-level journeys: line; the test titles carry the ids')
  else if (fileLevel && !legacy.has(file)) errors.push('file-level tag: put the id in the test title')
  return { ids: [...new Set([...titles.ids, ...(legacy.has(file) ? tags.ids : [])])], errors }
}

// readText(file) returns the file's text, or null when it is gone.
export function legacyErrors(list, readText) {
  if (!Array.isArray(list) || list.some((f) => typeof f !== 'string')) return ['legacy-file-tags.json must be an array of repo-relative paths']
  const errors = []
  list.forEach((file, i) => {
    if (i && file === list[i - 1]) errors.push(`duplicate legacy entry ${file}`)
    else if (i && file < list[i - 1]) errors.push(`legacy entry ${file} is out of order`)
    const text = readText(file)
    if (text === null) errors.push(`stale legacy entry, delete it: ${file} does not exist`)
    else if (!parseTags(text).ids.length) errors.push(`stale legacy entry, delete it: ${file} has no file-level journeys: line`)
  })
  return errors
}

const NOTIFICATION_TYPE = /^[a-z][a-z0-9_]*$/
const validWaiver = (w) => {
  if (typeof w?.reason !== 'string' || !w.reason.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(w.date ?? '')) return false
  const t = new Date(`${w.date}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(w.date) && w.date <= new Date().toISOString().slice(0, 10)
}

const RULES = [
  { name: 'id', fails: (r) => ID.test(r.id) ? null : `id must match ${ID}` },
  { name: 'platform', fails: (r) => PLATFORMS.includes(r.platform) ? null : r.platform === undefined ? 'platform is missing' : `unknown platform "${r.platform}"` },
  { name: 'seat', fails: (r) => SEATS.includes(r.seat) ? null : `unknown seat "${r.seat}"` },
  { name: 'setter', fails: (r) => SETTERS.includes(r.setter) ? null : `unknown setter "${r.setter}"` },
  { name: 'route', fails: (r) => typeof r.route === 'string' && r.route ? null : 'route is missing' },
  { name: 'kind', fails: (r) => KINDS.includes(r.kind) ? null : r.kind === undefined ? 'kind is missing' : `unknown kind "${r.kind}"` },
  { name: 'device', fails: (r) => typeof r.device === 'boolean' ? null : 'device must be true or false' },
  { name: 'required', fails: (r) => Array.isArray(r.required) && r.required.length ? null : 'required is empty' },
  { name: 'layer-known', fails: (r) => { const bad = (r.required ?? []).find((l) => !(l in LAYERS)); return bad === undefined ? null : `unknown layer "${bad}"` } },
  { name: 'layer-legal', fails: (r) => {
    if (!PLATFORMS.includes(r.platform)) return null
    const bad = (r.required ?? []).find((l) => l in LAYERS && !legalFor(r.platform).includes(l))
    return bad === undefined ? null : `layer "${bad}" is not legal for platform "${r.platform}"`
  } },
  { name: 'unit-required', fails: (r) => !PLATFORMS.includes(r.platform) || (r.required ?? []).includes(`${r.platform}-unit`) ? null : `required must include ${r.platform}-unit` },
  { name: 'api-required', fails: (r) => !(r.api ?? []).length || (r.required ?? []).includes('api') ? null : 'a row with an api call must require api' },
  { name: 'kind-layers', fails: (r) => {
    if (!PLATFORMS.includes(r.platform) || !KINDS.includes(r.kind)) return null
    const need = r.kind === 'static' ? [`${r.platform}-unit`] : r.kind === 'nav' ? [`${r.platform}-unit`, `${r.platform}-e2e`] : [`${r.platform}-unit`, `${r.platform}-e2e`, 'api']
    const missing = need.find((l) => !(r.required ?? []).includes(l))
    return missing === undefined ? null : `${r.kind} requires ${missing}`
  } },
  { name: 'notifies-api', fails: (r) => !(r.notifies ?? []).some((n) => NOTIFICATION_TYPE.test(n)) || (r.required ?? []).includes('api') ? null : 'a row that notifies must require api' },
  { name: 'device-required', fails: (r) => {
    const has = (r.required ?? []).includes('device')
    return r.device === true && !has ? 'device: true requires device' : has && r.device !== true ? 'required device needs device: true' : null
  } },
  { name: 'waiver-shape', fails: (r) => {
    const bad = Object.entries(r.waived ?? {}).find(([, w]) => !validWaiver(w))
    return bad === undefined ? null : `waived "${bad[0]}" must be { reason, date: YYYY-MM-DD, not in the future }`
  } },
  { name: 'waiver', fails: (r) => { const bad = Object.keys(r.waived ?? {}).find((l) => !(r.required ?? []).includes(l)); return bad === undefined ? null : `waived layer "${bad}" is not required` } },
]

export function validateRows(rows) {
  const errors = rows.flatMap((row) => RULES.flatMap(({ name, fails }) => { const message = fails(row); return message ? [{ id: row.id, rule: name, message }] : [] }))
  const seen = new Set()
  for (const { id } of rows) {
    if (seen.has(id)) errors.push({ id, rule: 'duplicate-id', message: 'id appears more than once' })
    seen.add(id)
  }
  return errors
}

export function coverage(journeys, filesByLayer) {
  const byId = new Map(journeys.map((j) => [j.id, j]))
  const covered = {}
  const unknown = []
  for (const [layer, files] of Object.entries(filesByLayer)) {
    covered[layer] = new Set()
    for (const [file, ids] of Object.entries(files)) {
      for (const id of ids) {
        const legal = byId.has(id) && (!LAYERS[layer].platform || LAYERS[layer].platform === byId.get(id).platform)
        if (legal) covered[layer].add(id)
        else unknown.push({ file, id })
      }
    }
  }
  const gaps = [], waived = []
  for (const j of [...journeys].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const layer of j.required) {
      if (covered[layer]?.has(j.id)) continue
      const reason = j.waived?.[layer]?.reason
      if (reason) waived.push({ id: j.id, layer, reason })
      else gaps.push({ id: j.id, layer })
    }
  }
  return { gaps, unknown, waived, covered }
}

// files are repo-relative paths. Web routes are page.tsx files; mobile routes are every .tsx
// under app/ except files or directories starting with _ or +.
export function routesFromFiles(files) {
  const under = (file, dir) => (file.startsWith(dir) ? file.slice(dir.length).split('/') : null)
  const web = new Set(), mobile = new Set()
  for (const file of files) {
    const w = under(file, 'packages/web/app/')
    if (w?.at(-1) === 'page.tsx') web.add('/' + w.slice(0, -1).filter((s) => !/^\(.*\)$/.test(s)).join('/'))
    const m = under(file, 'packages/mobile/app/')
    if (m?.at(-1).endsWith('.tsx') && !m.some((s) => /^[_+]/.test(s))) mobile.add(m.join('/').slice(0, -'.tsx'.length))
  }
  return { web: [...web].sort(), mobile: [...mobile].sort() }
}

// optOuts is { "<platform> <route>": reason }, keys sorted; a "TODO:" reason is a placeholder.
export function routeTripwire(rows, routes, optOuts) {
  const errors = []
  const keys = Object.keys(optOuts)
  keys.forEach((key, i) => {
    if (i && key <= keys[i - 1]) errors.push(`routes-without-journeys.json: ${key} is ${key === keys[i - 1] ? 'duplicated' : 'out of order'}`)
    if (typeof optOuts[key] !== 'string' || !optOuts[key].trim()) errors.push(`routes-without-journeys.json: ${key} needs a reason`)
  })
  const rowed = new Set(rows.map((r) => `${r.platform} ${r.route}`))
  const real = new Set(PLATFORMS.flatMap((p) => (routes[p] ?? []).map((route) => `${p} ${route}`)))
  for (const key of real) if (!rowed.has(key) && !(key in optOuts)) errors.push(`no journey row: ${key}`)
  for (const key of keys) {
    if (!real.has(key)) errors.push(`stale opt-out, delete it: ${key} does not exist`)
    else if (rowed.has(key)) errors.push(`stale opt-out, delete it: ${key} has rows`)
  }
  for (const r of rows) if (!real.has(`${r.platform} ${r.route}`)) errors.push(`${r.id}: route "${r.route}" matches no file`)
  return errors
}

const cell = (text) => String(text).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
const byId = (a, b) => a.id.localeCompare(b.id)

export function renderDoc(journeys, cov, legacyCount, routesWithout) {
  if (!journeys.length) throw new Error('journeys.json has no rows')
  const groups = []
  for (const j of [...journeys].sort(byId)) {
    let g = groups.find((x) => x.platform === j.platform && x.screen === j.screen)
    if (!g) groups.push((g = { platform: j.platform, screen: j.screen, rows: [] }))
    g.rows.push(j)
  }
  const tally = (g) => {
    const ids = new Set(g.rows.map((r) => r.id))
    return { rows: g.rows.length, gaps: cov.gaps.filter((x) => ids.has(x.id)).length, waived: cov.waived.filter((x) => ids.has(x.id)).length }
  }
  const mark = (j, layer) => (!j.required.includes(layer) ? '–' : cov.covered[layer]?.has(j.id) ? '✅' : j.waived?.[layer] ? `⚠️ ${cell(j.waived[layer].reason)}` : '❌')
  const table = (g) => {
    const layers = legalFor(g.platform)
    return [
      `| ID | Kind | Route | Seat | Element | Notifies | Counts | Setter | ${layers.join(' | ')} |`,
      `|${'---|'.repeat(8 + layers.length)}`,
      ...g.rows.map((j) =>
        `| ${j.id} | ${j.kind} | \`${cell(j.route)}\` | ${j.seat} | ${cell(j.element)} | ${cell(j.notifies.join(', ') || '–')} | ${cell(j.counts.join(', ') || '–')} | ${cell(j.setter)} | ${layers.map((l) => mark(j, l)).join(' | ')} |`),
    ]
  }
  const platforms = [...new Set(groups.map((g) => g.platform))].sort()
  return [
    '# Journeys — coverage map',
    '',
    'Generated by `scripts/journeys/render.mjs` from `scripts/journeys/journeys.json`; do not edit. ✅ a tagged test covers the layer · ❌ required and missing · ⚠️ waived (reason) · – not required.',
    '',
    `Gaps: ${cov.gaps.length} · Waived: ${cov.waived.length} · Legacy-tagged files: ${legacyCount} · Routes without rows: ${routesWithout}`,
    '',
    '| Platform | Screen | Rows | Gaps | Waived |',
    '|---|---|---|---|---|',
    ...groups.map((g) => { const t = tally(g); return `| ${g.platform} | ${cell(g.screen)} | ${t.rows} | ${t.gaps} | ${t.waived} |` }),
    '',
    ...platforms.flatMap((platform) => [
      `## ${platform[0].toUpperCase()}${platform.slice(1)}`,
      '',
      ...groups.filter((g) => g.platform === platform).flatMap((g) => {
        const t = tally(g)
        const heading = `### ${cell(g.screen)} — ${t.rows} rows · ${t.gaps} gaps · ${t.waived} waived`
        return t.gaps
          ? [heading, '', ...table(g), '']
          : [heading, '', `<details><summary>${t.rows} rows, no gaps</summary>`, '', ...table(g), '', '</details>', '']
      }),
    ]),
  ].join('\n')
}

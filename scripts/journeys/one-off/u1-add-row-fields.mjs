// One-off: gives every mobile row platform, route, kind and device. Fails on an
// id without a route or a route without a screen file under packages/mobile/app.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const path = resolve(root, 'scripts/journeys/journeys.json')

const group = (route, ids) => Object.fromEntries(ids.split(' ').map((id) => [id, route]))
const ROUTES = {
  ...group('(auth)/welcome', 'A01 A02'),
  ...group('(auth)/sign-in', 'A03'),
  ...group('(auth)/create-account', 'A04'),
  ...group('(auth)/sign-in', 'A05'),
  ...group('(auth)/code-sign-in', 'A06'),
  ...group('(auth)/verify', 'A07 A08'),
  ...group('(auth)/forgot-password', 'A09'),
  ...group('(auth)/reset-password', 'A10'),
  ...group('terms', 'A11 A12'),
  ...group('not-built', 'A13'),
  ...group('index', 'A14'),
  ...group('(tabs)/home/index', 'H01 H02 H03 H04 H05 H06 H07'),
  ...group('(tabs)/guides/index', 'G01 G02 G03 G04 G05 G06 G07'),
  ...group('(tabs)/guides/[id]/index', 'G08 G09 G10 G11 G12 G13 G14 G15 G16 G18 G19 G20 G21 G22 G23 G24 G25 G26 G27 G28 G29 G30'),
  ...group('(tabs)/guides/[id]/preview', 'G17'),
  ...group('(tabs)/guides/[id]/model', 'G31'),
  ...group('(tabs)/guides/[id]/build', 'B01 B02 B03 B04 B05 B06 B07'),
  ...group('(tabs)/guides/contributor/[id]', 'S01 S02 S03 S04'),
  ...group('(tabs)/guides/new', 'N01 N02 N03 N04 N05 N06'),
  ...group('(my)/tutorials/index', 'T01 T02 T03'),
  ...group('(my)/tutorials/[id]/index', 'T04 T05 T06 T07'),
  ...group('(my)/tutorials/[id]/details', 'T08 T20 T21 T22'),
  ...group('(my)/tutorials/[id]/parts', 'T09'),
  ...group('(my)/tutorials/[id]/steps', 'T10 T11'),
  ...group('(my)/tutorials/[id]/safety', 'T12'),
  ...group('(my)/tutorials/[id]/photos', 'T13'),
  ...group('(my)/tutorials/[id]/files', 'T14'),
  ...group('(my)/tutorials/[id]/stl', 'T15'),
  ...group('(my)/tutorials/[id]/picks', 'T16'),
  ...group('(my)/tutorials/[id]/suits', 'T17'),
  ...group('(my)/tutorials/[id]/backing', 'T18 T19'),
  ...group('(my)/organisation/index', 'L01 L02'),
  ...group('(my)/organisation/[tutorialId]', 'L03 L04 L05 L06 L07'),
  ...group('(my)/organisation/toys', 'L08 L09 L10'),
  ...group('(my)/organisation/orders', 'L11'),
  ...group('(my)/organisation/recycling', 'L12 L13 L14 L15'),
  ...group('(my)/organisation/requests', 'L16 L17'),
  ...group('(my)/organisation/publish', 'L18 L21 L22'),
  ...group('(my)/organisation/events/new', 'L19'),
  ...group('(my)/organisation/stories/new', 'L20'),
  ...group('(my)/organisation/profile', 'L23 L25 L26 L27'),
  ...group('(my)/thanks', 'L24'),
  ...group('(my)/organisation/messages', 'L28'),
  ...group('(my)/messages/[cid]', 'L29'),
  ...group('(my)/news/[kind]/[id]', 'L30'),
  ...group('(my)/account/index', 'L31 Z01 Z02 Z03 Z04 Z06 Z10'),
  ...group('(tabs)/toy-library/organisation/[id]', 'P01 P02 P03 P04 P05 P06 P07 P08 P09'),
  ...group('(my)/messages/org/[orgId]', 'P10'),
  ...group('(tabs)/toy-library/index', 'Y01 Y02 Y03'),
  ...group('(tabs)/toy-library/[id]', 'Y04 Y05 Y06 Y07 Y08'),
  ...group('(tabs)/toy-library/organisations', 'Y09'),
  ...group('(my)/toys/index', 'W01'),
  ...group('(my)/toys/new', 'W02'),
  ...group('(my)/toys/[id]/index', 'W03 W04 W05 W12'),
  ...group('(my)/toys/[id]/edit', 'W06 W07 W08 W09 W10 W11'),
  ...group('(my)/exchanges/index', 'X01'),
  ...group('(my)/exchanges/[id]', 'X02 X03 X04 X05 X06 X07 X08 X09 X10 X11 X12 X13 X14'),
  ...group('(tabs)/explore/challenges/index', 'C01'),
  ...group('(tabs)/explore/challenges/[id]', 'C02 C03 C04 C05 C06 C07 C08 C09 C10 C11'),
  ...group('(tabs)/explore/challenges/new', 'C12 C13 C14'),
  ...group('(my)/challenges/index', 'C15'),
  ...group('(tabs)/explore/makers-wanted/index', 'K01 K02 K14'),
  ...group('(my)/exchanges/build/ask/[id]', 'K03 K04'),
  ...group('(tabs)/explore/makers-wanted/new', 'K05'),
  ...group('(my)/exchanges/build/[id]', 'K06 K07 K08 K09 K10 K11 K12 K13'),
  ...group('printing/index', 'R01 R02'),
  ...group('printing/request', 'R03'),
  ...group('printing/jobs/[id]', 'R04 R05 R06 R07 R08 R09 R10 R11'),
  ...group('(my)/print-for-others/index', 'R12 R13 R14 R15 R16'),
  ...group('(my)/print-for-others/add', 'R17'),
  ...group('(my)/print-requests', 'R18'),
  ...group('printing/basics', 'R19'),
  ...group('(my)/events', 'V01 V02 V03'),
  ...group('(tabs)/explore/recycling', 'V04 V05 V06'),
  ...group('(my)/saved/index', 'V07'),
  ...group('(my)/saved/[slug]', 'V08 V09'),
  ...group('(my)/account/delete', 'Z05'),
  ...group('(my)/account/child/[id]', 'Z07 Z08'),
  ...group('(onboarding)/child', 'Z09'),
  ...group('(tabs)/me', 'Q01 Q02 Q03 Q04'),
  ...group('(tabs)/inbox', 'Q05 Q06 Q07 Q08 Q09 Q10'),
  ...group('(tabs)/map', 'Q11 Q12'),
  ...group('(tabs)/explore/index', 'Q13 Q14'),
  ...group('(tabs)/explore/learn/[slug]', 'Q15'),
  ...group('(tabs)/explore/about', 'Q16'),
  ...group('(my)/admin', 'Q17'),
  ...group('(my)/admin/review/index', 'Q18'),
  ...group('(my)/admin/review/[id]', 'Q19'),
}

const WRITE_VERB = /^(POST|PATCH|PUT|DELETE)/
const kind = (r) =>
  r.api.some((a) => WRITE_VERB.test(a)) || r.db.length ? 'write' : !r.api.length && r.required.length === 1 ? 'static' : 'nav'

const rows = JSON.parse(readFileSync(path, 'utf8'))
const problems = []
for (const r of rows) {
  const route = ROUTES[r.id]
  if (!route) problems.push(`${r.id}: no route`)
  else if (!existsSync(resolve(root, 'packages/mobile/app', `${route}.tsx`))) problems.push(`${r.id}: no file for ${route}`)
}
for (const id of Object.keys(ROUTES)) if (!rows.some((r) => r.id === id)) problems.push(`${id}: route for an unknown row`)
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }

const out = rows
  .map(({ id, seat, screen, element, api, db, notifies, counts, setter, required, waived }) =>
    ({ id, platform: 'mobile', route: ROUTES[id], kind: kind({ api, db, required }), device: required.includes('device'),
      seat, screen, element, api, db, notifies, counts, setter, required, ...(waived && { waived }) }))
  .sort((a, b) => a.id.localeCompare(b.id))
writeFileSync(path, '[\n' + out.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n')
const tally = {}
for (const r of out) tally[r.kind] = (tally[r.kind] ?? 0) + 1
console.log(`${out.length} rows`, tally)

# Mobile Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure the mobile app against the 61-screen Claude Design mobile board, numerically (Expo web build) and by picture (iOS simulator), and close every finding by fixing it or explaining it.

**Architecture:** The web parity harness's loop moves from `run.js` into `harness.js` as `runParity(target)`. `run.js` (web) and a new `app.js` (mobile) each only describe their target: map, URLs, viewport, scope, sign-in. Both share `fingerprint.js`, `compare.js` (including `explain()`), `seed.js` and `auth.js`, gaining options rather than forks. A Maestro-driven picture pass adds `picture` findings to the same report.

**Tech Stack:** Node (CommonJS scripts), Playwright (resolved from `packages/web`), Expo web export + `serve`, Maestro on the iOS simulator, Python 3 (`sidebyside.py`), vitest (the API drift test).

**Spec:** `docs/superpowers/specs/2026-09-30-mobile-parity-design.md`

## Global Constraints

- Harness code lives in `scripts/parity/`; nothing is copied from the web runner. Mobile needs are options on shared modules.
- The app is measured at a **390×844** viewport; the board at **1440×960**, scoped to `[data-screen-label]`.
- The app web export is served on **:3112**, beside web :3110, API :3111 and the artboard :8899.
- Exemptions use the web schema: `explained: [{ type, match, why: 'intended'|'fixture'|'pending', reason | pending }]`.
- Done = `scripts/parity/app-parity-report.json` shows **0 unexplained findings across all 61 board screens**, picture findings included.
- Web parity must stay at **118/118 clean, 0 findings** after every harness change.
- One commit per fix. Commit messages end with the two attribution lines: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV`.
- Web and mobile e2e never run at the same time. Stop the parity stack (`./scripts/parity/stack.sh down`) before any e2e run.
- Push with `git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin development` (osxkeychain hangs in this environment).
- Out of scope: Android, and building pending-registry features.

## Review Focus

1. **A signed-in screen that bounces to `/sign-in`** (a failed sign-in or an auth gate) must be a row `error`, never a comparison against the sign-in form. That is the web harness's largest historical false-finding source. Test in Task 5.
2. **The intro overlay** ("Skip intro", `app/_layout.tsx`) on the web export must be dismissed before fingerprinting, or every screen measures the overlay. Test in Task 5.
3. **The excluded tab bar** must contribute no headings, buttons or copy. Test in Task 1.
4. **An `idFrom` record the seed did not create** must skip the row with a reason, not compare against a list page. Test in Task 5.
5. **A board route with no app file** must fail a check before any browser runs, not surface as a mystery 404 finding. Test in Task 3.

---

### Task 1: Shared fingerprint and compare options

**Files:**
- Modify: `scripts/parity/fingerprint.js` (`collectFingerprint`, `visible`, `headingLike`)
- Modify: `scripts/parity/compare.js` (the page-height check)
- Create: `scripts/parity/fingerprint.test.js`
- Modify: `scripts/parity/compare.test.js`

**Interfaces:**
- Produces: `collectFingerprint(arg)`, where `arg` is either the old root selector string or `{ root: string, exclude?: string }`. Elements inside `exclude` are invisible to every collector.
- Produces: `role="heading"` elements are treated as semantic headings (same as `H1`–`H6`), with level taken from `aria-level`.
- Produces: `compare(board, live, { height: false })` skips the page-height check. React Native web screens scroll inside their own container, so the root is always the viewport's height.

- [ ] **Step 1: Write the failing fingerprint test**

`scripts/parity/fingerprint.test.js`:

```js
/**
 * Run: node scripts/parity/fingerprint.test.js
 * collectFingerprint runs in a page, so it is tested in one.
 */
const assert = require('node:assert')
const path = require('path')
const { collectFingerprint } = require('./fingerprint')
const { chromium } = require(
  require.resolve('@playwright/test', { paths: [path.resolve(__dirname, '../../packages/web')] })
)

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(`
    <main id="screen">
      <div role="heading" aria-level="2" style="font-size:14px;font-weight:800;text-transform:none">Your guides</div>
      <p style="font-size:15px">A paragraph long enough to count as prose on this screen.</p>
      <nav role="tablist" id="tabs">
        <div style="font-size:22px;font-weight:800">Guides</div>
        <button style="background:rgb(20,90,200);color:white;padding:10px">Toys</button>
      </nav>
    </main>`)
  const fp = await page.evaluate(collectFingerprint, { root: '#screen', exclude: '#tabs' })
  const texts = fp.headings.map((h) => h.text)
  assert.ok(texts.includes('your guides'), 'role=heading at 14px not treated as semantic')
  assert.ok(!texts.includes('guides'), 'excluded tab bar heading leaked in')
  assert.strictEqual(fp.counts.buttons, 0, 'excluded tab bar button counted')
  // The old string form still works.
  const legacy = await page.evaluate(collectFingerprint, '#screen')
  assert.ok(legacy.headings.map((h) => h.text).includes('guides'), 'string root form broken')
  await browser.close()
  console.log('fingerprint: 3 checks passed')
})()
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/parity/fingerprint.test.js`
Expected: FAIL. `querySelector` receives an object, the root falls back to `body`, and the assertion `excluded tab bar heading leaked in` fails.

- [ ] **Step 3: Implement the options in `fingerprint.js`**

At the top of `collectFingerprint`:

```js
function collectFingerprint(arg) {
  const { root: rootSelector, exclude } = typeof arg === 'string' ? { root: arg } : arg
  const root = document.querySelector(rootSelector) || document.body
```

In `visible`, first line:

```js
  const visible = (el) => {
    // An excluded region (the app's tab bar, its stack header) is chrome the
    // board draws in its frame, outside the screen being compared.
    if (exclude && el.closest(exclude)) return false
```

In `headingLike`, replace the `semantic` line:

```js
    const semantic = /^H[1-6]$/.test(el.tagName) || el.getAttribute('role') === 'heading'
```

Wherever the heading's level is recorded from `tagName`, use `aria-level` for a role heading. Find it with `grep -n "level" scripts/parity/fingerprint.js`, and set:

```js
    level: /^H[1-6]$/.test(el.tagName) ? +el.tagName[1] : +(el.getAttribute('aria-level') || 2),
```

The final `return` of `headingLike` also tests `/^H[1-6]$/.test(el.tagName)`. Change it to `semantic`.

Check that every collector (headings, cards, buttons, inputs, paragraphs) filters through `visible`. Run `grep -n "visible(" scripts/parity/fingerprint.js`. Any collector that doesn't gets `.filter(visible)` added.

- [ ] **Step 4: Run the fingerprint test**

Run: `node scripts/parity/fingerprint.test.js`
Expected: `fingerprint: 3 checks passed`

- [ ] **Step 5: Write the failing compare test**

Append to `scripts/parity/compare.test.js`:

```js
// A React Native web screen scrolls inside its own container, so its root is
// the viewport's height whatever the content; height is not comparable there.
{
  const board = fp([h(1, 'guides')], { page: { ...fp([]).page, height: 2400 } })
  const live = fp([h(1, 'guides')], { page: { ...fp([]).page, height: 844 } })
  assert.ok(compare(board, live).some((x) => x.what === 'page height differs grossly'), 'height check lost')
  assert.ok(!compare(board, live, { height: false }).some((x) => /page height/.test(x.what)), 'height: false ignored')
}
```

- [ ] **Step 6: Run it to verify it fails**

Run: `node scripts/parity/compare.test.js`
Expected: FAIL with `height: false ignored`.

- [ ] **Step 7: Implement `height: false`**

In `compare.js`, find the height check with `grep -n "page height differs grossly" scripts/parity/compare.js` and guard its block:

```js
  if (opts.height !== false && /* existing condition */) {
```

Keep the existing condition unchanged inside the guard.

- [ ] **Step 8: Run both tests and the web measurement**

Run: `node scripts/parity/compare.test.js && node scripts/parity/fingerprint.test.js`
Expected: both pass.
Run: `./scripts/parity/stack.sh up && (cd packages/web && node ../../scripts/parity/run.js) | tail -12`
Expected: `"clean": 118`, `"findings": 0`, `"explained": 15`.

- [ ] **Step 9: Commit**

```bash
git add scripts/parity/fingerprint.js scripts/parity/fingerprint.test.js scripts/parity/compare.js scripts/parity/compare.test.js scripts/parity/parity-report.json
git commit -m "feat(parity): fingerprint excludes chrome and reads role=heading; height comparison optional"
```

---

### Task 2: Move the loop into `harness.js`

**Files:**
- Create: `scripts/parity/harness.js`
- Modify: `scripts/parity/run.js` (becomes a target description)

**Interfaces:**
- Produces: `runParity(target)` in `scripts/parity/harness.js`, where `target` is:

```js
{
  map: string,            // absolute path of the screen map JSON
  report: string,         // absolute path of the report JSON
  board: string,          // artboard page URL, without the #hash
  live: string,           // live origin
  pairsDir: string,       // where --shots writes <id>.board.png / <id>.live.png
  boardViewport: { width, height },
  liveViewport: { width, height },
  liveScope: string | { root, exclude },   // collectFingerprint arg for the live side
  launchArgs: string[],   // chromium.launch({ args })
  signIn: (context, liveOrigin, user) => Promise<{ ok, reason? }>,
  prepare: async (page) => void,           // after each live goto, before fingerprinting
  resolve: async (s, ctx) => string|null,  // route resolver; ctx as routes.js resolveRoute
  compareOpts: (s) => object,              // extra compare() options per screen
}
```

- Produces: `run.js` exports nothing and runs `runParity(WEB)`. CLI flags (`--id`, `--group`, `--failing`, `--shots`) are parsed inside `harness.js` from `process.argv`, unchanged.

- [ ] **Step 1: Create `harness.js` by moving code**

Move everything in `run.js` below the `require`s into `harness.js`: `loadMap`, `flag`, `fingerprintOf` and the body of the `(async () => { … })()`. Make the body `async function runParity(target)` and export it with `module.exports = { runParity }`. Then apply exactly these substitutions:

| In the old run.js | In harness.js |
|---|---|
| `JSON.parse(fs.readFileSync(path.join(__dirname, 'screen-map.json')))` | `JSON.parse(fs.readFileSync(target.map, 'utf8'))` (read inside `runParity`; `loadMap(all)` takes the array) |
| `REPORT` | `target.report` (keep the `PARITY_REPORT` env override: `process.env.PARITY_REPORT \|\| target.report`) |
| `ARTBOARD` | `target.board` |
| `LIVE` | `target.live` |
| `PAIRS` | `target.pairsDir` |
| `chromium.launch()` | `chromium.launch({ args: target.launchArgs \|\| [] })` |
| `newContext({ viewport: VIEWPORT })` for the board | `newContext({ viewport: target.boardViewport })` |
| `newContext({ viewport: VIEWPORT })` for guest and role contexts | `newContext({ viewport: target.liveViewport })` |
| `signIn(ctx, LIVE, users[role])` | `target.signIn(ctx, target.live, users[role])` |
| `resolveRoute(s, {...})` | `target.resolve(s, {...})` (same ctx object) |
| `livePage.evaluate(collectFingerprint, 'main')` | `await target.prepare(livePage)` then `livePage.evaluate(collectFingerprint, target.liveScope)` |
| the `compare(board, live, { … })` options object | spread `...target.compareOpts(s)` after the existing keys |
| `.live.png` in the `--shots` path | unchanged (`<id>.live.png`) |

`NO_COPY`, `SHOTS` and the partial-run merge stay as they are, inside `harness.js`.

- [ ] **Step 2: Rewrite `run.js` as the web target**

```js
/**
 * Web parity: drive the live web app and the web artboard over screen-map.json
 * and write parity-report.json. The loop is harness.js; this names the target.
 *
 *   node scripts/parity/run.js                  # every screen
 *   node scripts/parity/run.js --group "About"  # one group
 *   node scripts/parity/run.js --id about,hub   # named screens
 *   node scripts/parity/run.js --failing        # only what last run flagged
 *   node scripts/parity/run.js --shots          # also save pairs/<id>.{board,live}.png
 *
 * The app's twin is app.js. Run from packages/web.
 */
const path = require('path')
const { runParity } = require('./harness')
const { signIn } = require('./auth')
const { resolveRoute } = require('./routes')

runParity({
  map: path.join(__dirname, 'screen-map.json'),
  report: path.join(__dirname, 'parity-report.json'),
  board: 'http://localhost:8899/SPLAT%20Connect%20-%20Web.dc.html',
  live: process.env.PARITY_LIVE || 'http://localhost:3110',
  pairsDir: path.join(__dirname, 'pairs'),
  boardViewport: { width: 1440, height: 960 },
  liveViewport: { width: 1440, height: 960 },
  liveScope: 'main',
  launchArgs: [],
  signIn,
  prepare: async () => {},
  resolve: resolveRoute,
  compareOpts: () => ({}),
})
```

Keep the existing explanatory comments (the "Regulatory wording…" block for `NO_COPY`, the `--failing` note) with the code they describe in `harness.js`.

- [ ] **Step 3: Verify web parity is byte-for-byte the same measurement**

Run: `cd packages/web && node ../../scripts/parity/run.js | tail -12`
Expected: `"clean": 118`, `"findings": 0`, `"explained": 15`, `"errored": 0`.
Run: `node ../../scripts/parity/run.js --id hub,org_public --shots && ls ../../scripts/parity/pairs/hub.live.png`
Expected: both screens ✓ and the file exists.

- [ ] **Step 4: Commit**

```bash
git add scripts/parity/harness.js scripts/parity/run.js scripts/parity/parity-report.json
git commit -m "refactor(parity): the comparison loop is harness.js; run.js names the web target"
```

---

### Task 3: The app screen map and its route check

**Files:**
- Create: `scripts/parity/app-screen-map.json`
- Create: `scripts/parity/app-map.test.js`
- Modify: `packages/api/tests/unit/pending-features.test.ts` (read both maps)

**Interfaces:**
- Produces: `app-screen-map.json`, an array of rows `{ id, name, group, boardRoute, route, role?, seedRole?, idFrom?, sampleFrom?, derivedFrom?, suffix?, stateOnly?, skip?, explained? }`. `id` is the board key and `#hash`. `route` is the expo-router URL (groups stripped, `[param]` kept). `idFrom` names a **web** screen id in `screen-map.json`. `skip` is a reason string.

- [ ] **Step 1: Write the failing route check**

`scripts/parity/app-map.test.js`:

```js
/**
 * Run: node scripts/parity/app-map.test.js
 * Every app-screen-map route must be a file in packages/mobile/app, found
 * the way expo-router finds it: (groups) are invisible in the URL, [x] is a
 * parameter, index.tsx is the folder. A board route with no app file fails
 * here, before any browser runs.
 */
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const APP = path.resolve(__dirname, '../../packages/mobile/app')
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-screen-map.json'), 'utf8'))
const web = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'screen-map.json'), 'utf8')).map((s) => s.id))

// Every app route file, as the URL expo-router serves it.
const routes = new Set()
;(function walk(dir, url) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name), /^\(.+\)$/.test(e.name) ? url : `${url}/${e.name}`)
    else if (/\.tsx$/.test(e.name) && !e.name.startsWith('_') && !e.name.startsWith('+')) {
      const name = e.name.replace(/\.tsx$/, '')
      routes.add(name === 'index' ? url || '/' : `${url}/${name}`)
    }
  }
})(APP, '')

const bare = (r) => r.split('?')[0]
const missing = map.filter((s) => !s.skip && !routes.has(bare(s.route))).map((s) => `${s.id} -> ${s.route}`)
assert.deepStrictEqual(missing, [], 'board screens mapped to routes the app does not have')
assert.strictEqual(map.length, 61, 'the board has 61 screens; every one needs a row')
assert.deepStrictEqual(map.filter((s) => s.idFrom && !web.has(s.idFrom)).map((s) => s.id), [], 'idFrom names no web screen')
assert.deepStrictEqual(map.filter((s) => s.skip !== undefined && !s.skip).map((s) => s.id), [], 'skip needs a reason')
console.log(`app map: ${map.length} screens, ${routes.size} app routes, all resolve`)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/parity/app-map.test.js`
Expected: FAIL with `ENOENT … app-screen-map.json`.

- [ ] **Step 3: Generate the first map from the board registry**

The board holds a registry of `[id, name, route, title, kind]` rows. Generate the map from it:

```bash
cd "Splat Connect frontend overhaul" && python3 - <<'EOF' > ../scripts/parity/app-screen-map.json
import re, json
s = open("SPLAT Connect - Mobile.dc.html", encoding="utf-8").read()
rows = re.findall(r"\['([a-z_0-9]+)', '([^']*)', '([^']*)', '([^']*)', '([a-z]+)'\]", s)
out = []
for key, name, route, title, kind in rows:
    url = '/' + '/'.join(p for p in route.split(' ')[0].split('/') if not re.fullmatch(r'\(.+\)', p))
    out.append({"id": key, "name": name, "group": kind, "boardRoute": route, "route": url})
print(json.dumps(out, indent=1))
EOF
cd .. && node scripts/parity/app-map.test.js
```

Expected: FAIL, listing the `missing` routes. That list is the work of the next step.

- [ ] **Step 4: Fix every row by hand until the check passes**

For each row the check reports, open `packages/mobile/app` (`find packages/mobile/app -name '*.tsx' | sort`) and do one of these:
- Set `route` to the real expo-router URL. For example, the board's editor sections are `tutorials/[id]/details`; find the app's equivalent file and write its URL.
- For the board's generic templates (`loading`, and any row whose `name` is "List screen"), set `route` to a representative real screen that uses that template, or set `"skip": "<why no single app screen shows this>"`.
- For the board's `article` (`explore/learn/[slug]`), set a fixed real slug: `ls packages/mobile/lib | grep -i learn`, then use its first slug in `route`.

Then add these fields:
- `role`: `"parent"` for any `(my)/` route or screen that requires sign-in. `"leader"` for `org_*` and `organisation/*`. `"admin"` for `admin`. `"contributor"` for `editor`, `ed_*` and `my_tutorials`. None for public tabs.
- `idFrom`, for every route containing a `[param]`:

| app id | idFrom (web screen) |
|---|---|
| guide_detail, guide_preview | tutorial |
| contributor | contributor |
| guide_org, lib_org | org_public |
| lib_toy | toy_public |
| print_job | print_job |
| challenge_detail | challenge_detail |
| build_thread | build_thread |
| exchange | thread |
| editor, ed_details, ed_steps, ed_parts, ed_tools, ed_safety, ed_stl | editor |
| toy_detail | toy_detail |
| child | child |

- `seedRole`: `"leader"` on guide_org and lib_org; `"parent"` on lib_toy (the web rows' seeding roles).
- `sampleFrom`, for any `[param]` route with no `idFrom` (`org_review`): the app list route whose links lead to it (`/organisation`).
- `stateOnly: true` on `sign_in` only if the app redirects a signed-in user away. Guest screens have no role, so leave it off.

Run after each batch: `node scripts/parity/app-map.test.js`
Expected at the end: `app map: 61 screens, N app routes, all resolve`

- [ ] **Step 5: Make the drift test read both maps**

In `packages/api/tests/unit/pending-features.test.ts`, inside `it('parity exemptions name open items and say why', …)`, replace the single `map` read with:

```ts
    const read = (f: string) =>
      JSON.parse(readFileSync(path.join(root, 'scripts/parity', f), 'utf8')) as {
        id: string
        explained?: { why: string; reason?: string; pending?: string }[]
      }[]
    const map = [...read('screen-map.json'), ...read('app-screen-map.json')]
```

Run: `cd packages/api && npx vitest run tests/unit/pending-features.test.ts && npx tsc --noEmit`
Expected: 6 passed; tsc exits 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/parity/app-screen-map.json scripts/parity/app-map.test.js packages/api/tests/unit/pending-features.test.ts
git commit -m "feat(parity): app screen map for the 61 mobile board screens, checked against the app's routes"
```

---

### Task 4: The app on the parity stack, and app sign-in

**Files:**
- Modify: `scripts/parity/stack.sh`
- Modify: `scripts/parity/auth.js` (add `signInApp`)

**Interfaces:**
- Produces: `stack.sh up` serves the mobile web export on `http://localhost:3112`. `stack.sh down` frees it.
- Produces: `signInApp(context, appOrigin, user) → Promise<{ ok: boolean, reason?: string }>` in `auth.js`, exported beside `signIn`.

- [ ] **Step 1: Add the app to `stack.sh`**

Add `APP_PORT=3112` beside the other ports, and add `$APP_PORT` to both `free_port` loops (`down` and `up`). After the Web block, add:

```bash
    # The mobile app's web export, measured by app.js. An export, not the dev
    # server: nothing here is edited mid-run, and HMR must not intervene.
    echo "App :$APP_PORT"
    (cd "$ROOT/packages/mobile" && \
      EXPO_PUBLIC_SUPABASE_URL="$SUPABASE_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
      EXPO_PUBLIC_API_URL="http://localhost:$API_PORT" \
      detach "$LOG_DIR/app.log" sh -c "./node_modules/.bin/expo export -p web --output-dir dist-parity --clear && ./node_modules/.bin/serve -s dist-parity -l $APP_PORT")
```

and a readiness wait after the others:

```bash
    wait_for "http://localhost:$APP_PORT/" "app" 150
```

Add `dist-parity/` to `packages/mobile/.gitignore`.

- [ ] **Step 2: Bring the stack up and check the app serves**

Run: `./scripts/parity/stack.sh up && curl -s http://localhost:3112/ | grep -c '<div id="root"'`
Expected: `app up`, then `1`.

- [ ] **Step 3: Add `signInApp` to `auth.js`**

Below `signIn`:

```js
/**
 * Sign in to the mobile app's web export through its real /sign-in form, as
 * packages/mobile/tests/e2e/helpers.ts signIn does. The session lives in the
 * app's storage, which only the app's own sign-in writes correctly.
 */
async function signInApp(context, appOrigin, user) {
  const page = await context.newPage()
  try {
    await page.goto(`${appOrigin}/sign-in`, { waitUntil: 'domcontentloaded' })
    await dismissIntro(page)
    await page.getByLabel('Email', { exact: true }).fill(user.email)
    await page.getByLabel('Password', { exact: true }).fill(user.password)
    await page.getByTestId('auth-submit').click()
    await page.waitForURL((url) => !new URL(url).pathname.startsWith('/sign-in'), { timeout: 30000 })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: String(err.message || err).slice(0, 160) }
  } finally {
    await page.close()
  }
}

/** The app plays an intro over everything on each cold start; skip it. */
async function dismissIntro(page) {
  const skip = page.getByLabel('Skip intro')
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skip.click()
    await skip.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  }
}
```

Export both: `module.exports = { provision, signIn, signInApp, dismissIntro, cleanup, adminClient: admin }`.

- [ ] **Step 4: Check sign-in works against the export**

Run:

```bash
node -e '
const path=require("path");const {chromium}=require(require.resolve("@playwright/test",{paths:[path.resolve("packages/web")]}));
const {provision,signInApp,cleanup}=require("./scripts/parity/auth");
(async()=>{const u=await provision(["parent"]);const b=await chromium.launch({args:["--disable-web-security"]});
const c=await b.newContext({viewport:{width:390,height:844}});console.log(await signInApp(c,"http://localhost:3112",u.parent));
await b.close();await cleanup(u)})()'
```

Expected: `{ ok: true }`

- [ ] **Step 5: Commit**

```bash
git add scripts/parity/stack.sh scripts/parity/auth.js packages/mobile/.gitignore
git commit -m "feat(parity): the mobile web export on the parity stack, and app sign-in"
```

---

### Task 5: `app.js`, the numeric runner

**Files:**
- Create: `scripts/parity/app.js`
- Create: `scripts/parity/app-routes.js`
- Create: `scripts/parity/app-routes.test.js`

**Interfaces:**
- Consumes: `runParity(target)` (Task 2), `signInApp` and `dismissIntro` (Task 4), `app-screen-map.json` (Task 3), `dbSample(db, webScreenId)` from `seed.js`, `resolveDynamic` from `routes.js`.
- Produces: `resolveAppRoute(s, ctx) → Promise<string|null>` in `app-routes.js`, plus the pure helper `withId(route, webRoute) → string|null`.
- Produces: `node scripts/parity/app.js [--id …|--group …|--failing|--shots]` writes `scripts/parity/app-parity-report.json` and `pairs/app/<id>.{board,live}.png`.

- [ ] **Step 1: Write the failing resolver test**

`scripts/parity/app-routes.test.js`:

```js
/** Run: node scripts/parity/app-routes.test.js */
const assert = require('node:assert')
const { withId } = require('./app-routes')

const id = '3babf3f0-908f-46cb-bf9c-b5a575c3bec8'
assert.strictEqual(withId('/guides/[id]', `/tutorials/${id}`), `/guides/${id}`)
assert.strictEqual(withId('/guides/[id]/preview', `/tutorials/${id}/edit`), `/guides/${id}/preview`)
assert.strictEqual(withId('/organisation/[tutorialId]', `/admin/review?selected=${id}`), `/organisation/${id}`)
// No record: no route. The row is skipped, never measured on a list page.
assert.strictEqual(withId('/guides/[id]', null), null)
assert.strictEqual(withId('/guides/[id]', '/library'), null)
console.log('app routes: 5 checks passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/parity/app-routes.test.js`
Expected: FAIL with `Cannot find module './app-routes'`.

- [ ] **Step 3: Implement `app-routes.js`**

```js
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
  if (!/\[/.test(s.route)) return s.route
  if (s.idFrom) return withId(s.route, ctx.seeded[s.idFrom] || (await dbSample(ctx.db, s.idFrom)))
  // Scraping needs a browser page; the picture pass has none and skips these.
  if (s.sampleFrom && ctx.page) return resolveDynamic(ctx.page, ctx.live, s, ctx.cache)
  return null
}

module.exports = { withId, resolveAppRoute }
```

- [ ] **Step 4: Run the resolver test**

Run: `node scripts/parity/app-routes.test.js`
Expected: `app routes: 5 checks passed`

- [ ] **Step 5: Make `harness.js` resolve every row, and error on a sign-in bounce**

In `harness.js`, the route is only resolved `if (s.sampleFrom)`. Change it so a target resolver always runs, and a `null` route skips the row:

```js
      if (s.skip) {
        row.skipped = true
        row.error = `skipped: ${s.skip}`
        results.push(row)
        continue
      }
      let route = await target.resolve(s, { page: livePage, live: target.live, seeded, cache, screens, allScreens, db: adminClient() })
      if (!route) {
        row.error = `no record for ${s.route}`
        row.skipped = true
        results.push(row)
        process.stdout.write(`  ~ ${s.id} (no fixture)\n`)
        continue
      }
      row.route = route
```

The web resolver already returns `s.route` for a row without `sampleFrom`, so web behaviour is unchanged.

After the live `goto` and `target.prepare(livePage)`, add:

```js
      // A signed-in screen that lands on a sign-in form is a failed fixture,
      // not a design finding: the harness once reported twelve "missing"
      // sections by comparing a hub against the login page.
      const landed = new URL(livePage.url()).pathname
      if (role !== 'guest' && /^\/(sign-in|login)\b/.test(landed)) {
        row.error = `bounced to ${landed} as ${role}`
        results.push(row)
        process.stdout.write(`  ! ${s.id} — ${row.error}\n`)
        continue
      }
```

The summary's `clean` count already excludes `row.error`, so a skipped row is never "clean". In `summary`, add `skipped: all.filter((r) => r.skipped).length` in both places `summary` is built.

- [ ] **Step 6: Write `app.js`**

```js
/**
 * Mobile parity: the app's web export at phone size against the mobile
 * artboard, over app-screen-map.json, into app-parity-report.json. The loop
 * is harness.js, shared with run.js (web). Run from packages/web (Playwright
 * resolves there), with ./scripts/parity/stack.sh up.
 *
 *   node ../../scripts/parity/app.js [--id a,b | --group push | --failing | --shots]
 *
 * The web export cannot see safe areas (react-native-web reports
 * insets.top = 0), native sheets or native fonts; app-shots.js is the picture
 * pass for those.
 */
const path = require('path')
const { runParity } = require('./harness')
const { signInApp, dismissIntro } = require('./auth')
const { resolveAppRoute } = require('./app-routes')

runParity({
  map: path.join(__dirname, 'app-screen-map.json'),
  report: path.join(__dirname, 'app-parity-report.json'),
  board: 'http://localhost:8899/SPLAT%20Connect%20-%20Mobile.dc.html',
  live: process.env.PARITY_APP || 'http://localhost:3112',
  pairsDir: path.join(__dirname, 'pairs', 'app'),
  boardViewport: { width: 1440, height: 960 },
  liveViewport: { width: 390, height: 844 },
  // The tab bar and the stack header are chrome the board draws in its frame.
  liveScope: { root: '#root', exclude: '[role="tablist"], header, [role="banner"]' },
  // The parity API's CORS admits the web origin only (packages/api/src/app.ts).
  launchArgs: ['--disable-web-security'],
  signIn: signInApp,
  prepare: dismissIntro,
  resolve: resolveAppRoute,
  // Screens scroll inside their own container; the root is always 844 tall.
  compareOpts: () => ({ height: false }),
})
```

In `harness.js`, the board side fingerprints with `'[data-screen-label]'` already. Confirm with `grep -n "data-screen-label" scripts/parity/harness.js`.

- [ ] **Step 7: Confirm the chrome selectors on the real export**

Run:

```bash
cd packages/web && node -e '
const {chromium}=require("@playwright/test");(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto("http://localhost:3112/guides");await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>({tablist:document.querySelectorAll("[role=tablist]").length,header:document.querySelectorAll("header,[role=banner]").length,skip:!!document.querySelector("[aria-label=\"Skip intro\"]")})));await b.close()})()'
```

Expected: `tablist: 1`, and `header` ≥ 0. If `tablist` is 0, find the tab bar's attributes with `p.evaluate(() => document.querySelector('a[href="/toy-library"]')?.closest('[role]')?.outerHTML.slice(0, 200))`, then set `exclude` in `app.js` to a selector that matches it. Re-run until the tab bar is matched.

- [ ] **Step 8: First run on three screens**

Run: `node ../../scripts/parity/app.js --id guides,guide_detail,my_splat --shots`
Expected: three rows, each `✓` or `×`, and none `!` (error). `ls ../../scripts/parity/pairs/app/` shows six PNGs. Open `pairs/app/guides.live.png` and confirm it shows the Guides screen, not the intro or the sign-in form.

- [ ] **Step 9: Commit**

```bash
git add scripts/parity/app.js scripts/parity/app-routes.js scripts/parity/app-routes.test.js scripts/parity/harness.js scripts/parity/app-parity-report.json
git commit -m "feat(parity): app.js measures the mobile app against the mobile board"
```

---

### Task 6: First full run, triage, and closing the numeric findings

**Files:**
- Modify: `scripts/parity/app-screen-map.json` (`explained`, route fixes)
- Modify: shared harness files, only when triage finds a measurement bug (each with a check in `compare.test.js` or `fingerprint.test.js`)
- Modify: `packages/mobile/**` (real drift fixes)
- Modify: `packages/types/src/pending.ts` and `docs/PENDING.md` (board features found missing)

This task's content is data-driven, so it is a procedure. Each loop is: triage, fix one thing, re-measure, commit.

- [ ] **Step 1: Full run with pictures**

Run: `cd packages/web && node ../../scripts/parity/app.js --shots | tail -15`
Record the summary: `clean`, `findings`, `errored`, `skipped`, `byType`.

- [ ] **Step 2: Fix every errored row before any finding**

Run: `node -e 'const r=require("../../scripts/parity/app-parity-report.json");for(const s of r.screens.filter(s=>s.error&&!s.skipped))console.log(s.id,s.error)'`
For each error: a bounce is a role or sign-in problem (fix the row's `role`, or the fixture). "no record" means the `idFrom` or `seedRole` is wrong. A timeout means the route is wrong. Re-run with `--id` until none remain.

- [ ] **Step 3: Triage every finding from the pictures**

Stitch pairs: `python3 ../../scripts/parity/sidebyside.py --dir ../../scripts/parity/pairs/app $(node -e 'const r=require("../../scripts/parity/app-parity-report.json");console.log(r.screens.filter(s=>s.findings.length).map(s=>s.id).join(" "))')`. If `sidebyside.py` has no `--dir` option, add one that defaults to `pairs/`.

Split the failing screens into groups of about eight by `group` (tab, push, modal). Dispatch one read-only agent per group, with the triage brief at `/private/tmp/claude-503/-Users-byronpetselis-Documents-splat-connect/b0fe4349-dbfc-4dfd-8f75-534114254cbd/scratchpad/triage-brief.md`. Before dispatch, copy that brief to `scripts/parity/TRIAGE.md` with its paths changed to the app ones (`app-parity-report.json`, `pairs/app/`, `SPLAT Connect - Mobile.dc.html`, `packages/mobile`), and commit it with this task. Each finding comes back classed as styling, pending, fixture, intended or harness-bug.

- [ ] **Step 4: Close the findings in this order**

1. **harness-bug:** fix the shared module, add the check to `compare.test.js` / `fingerprint.test.js`, and confirm web stays 118/118 (`node ../../scripts/parity/run.js | tail -8`). Commit: `fix(parity): <what it mis-measured>`.
2. **fixture:** give the seed or the row the board's state (the web precedent: seeded events, org doors, swap toy). Explain a fixture only when no honest seed exists. Commit: `fix(parity): <fixture>`.
3. **styling:** fix it in `packages/mobile`, with the board value or token cited in the commit body. One commit per fix: `fix(mobile): <what now matches>`. After each, run `cd packages/mobile && npx jest --silent 2>&1 | tail -3`; expect all suites to pass.
4. **pending:** a board feature the app lacks. If it's registered, add a `pending` exemption. If not, register it in `packages/types/src/pending.ts` with a `PENDING(<id>)` marker at the screen, run `node scripts/pending.mjs`, then add the exemption. Commit: `chore: register <id>`.
5. **intended:** an exemption whose `reason` says what the difference does for users. Commit it with the related fix, or on its own.

Re-measure after each loop: `node ../../scripts/parity/app.js --failing`.

- [ ] **Step 5: Confirm with a full run**

Run: `node ../../scripts/parity/app.js | tail -12`
Expected: `"findings": 0`, `"errored": 0`. Every `skipped` row has a reason in the map. Any `stale-exemption` finding means an exemption outlived its cause, so delete it.

- [ ] **Step 6: Commit the report**

```bash
git add scripts/parity/app-parity-report.json
git commit -m "chore(parity): app numeric parity closed (<clean>/61 clean, 0 findings, <n> explained)"
```

---

### Task 7: The picture pass on the iOS simulator

**Files:**
- Create: `scripts/parity/app-shots.js`
- Create: `packages/mobile/.maestro/parity/sign-in.yaml`
- Modify: `scripts/parity/sidebyside.py` (the `--dir` option, if not already added in Task 6)
- Modify: `scripts/parity/app-parity-report.json` (merged `picture` findings)

**Interfaces:**
- Consumes: `provision`, `cleanup` from `auth.js`; `seed`, `unseed` from `seed.js`; `resolveAppRoute` from `app-routes.js`; `explain` from `compare.js`; `app-screen-map.json`.
- Produces: `node scripts/parity/app-shots.js [--id …]` writes `pairs/app/<id>.ios.png` for every non-skipped row, and `pairs/app-ios/<id>-<n>.png` side-by-sides (board | iOS).
- Produces: `node scripts/parity/app-shots.js --record <findings.json>` merges `[{ id, what, board, live }]` into `app-parity-report.json` as `type: 'picture'` findings, run through `explain()` with that row's exemptions.

- [ ] **Step 1: Preconditions check**

Run: `xcrun simctl list devices booted | grep -c Booted && xcrun simctl listapps booted | grep -c com.splatconnect.mobile && maestro --version`
Expected: `1`, `1`, and a version. If the app is missing, or is older than the current native modules, rebuild per the stale-prebuild memory: `cd packages/mobile && npx expo prebuild -p ios --clean && npx expo run:ios`. Point the app at the parity API: run `EXPO_PUBLIC_API_URL=http://localhost:3111` in the Metro environment, or it reads the dev API.

- [ ] **Step 2: The sign-in subflow**

`packages/mobile/.maestro/parity/sign-in.yaml`:

```yaml
# Parity picture pass: land signed in as ${EMAIL}, whoever was signed in
# before. iOS keeps the session in the Keychain across clearState, so sign out
# first when the tabs are showing (sign-out-clears-session.yaml's path).
appId: com.splatconnect.mobile
---
- clearState
- runFlow: ../subflows/launch.yaml
- runFlow:
    when:
      notVisible:
        id: "welcome-sign-in"
    commands:
      - tapOn:
          text: "MY SPLAT"
      - tapOn:
          text: "Account & child profiles"
      - tapOn:
          text: "Sign Out"
- runFlow:
    when:
      true: ${EMAIL != ''}
    commands:
      - tapOn:
          id: "welcome-sign-in"
      - tapOn:
          id: "email-input"
      - inputText: ${EMAIL}
      - tapOn:
          id: "password-input"
      - inputText: ${PASSWORD}
      - hideKeyboard
      - tapOn:
          id: "auth-submit"
      - tapOn:
          text: "Not Now"
          optional: true
```

- [ ] **Step 3: Write `app-shots.js`**

```js
/**
 * The picture pass: every mapped screen on the iOS simulator, beside the
 * board. It sees what the web export cannot: safe areas, native sheets and
 * native fonts. Run from packages/web, with the parity stack up and the app
 * installed on the booted simulator.
 *
 *   node ../../scripts/parity/app-shots.js [--id a,b]   # shoot and stitch
 *   node ../../scripts/parity/app-shots.js --record f.json  # merge judged findings
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { provision, cleanup, adminClient } = require('./auth')
const { seed, unseed } = require('./seed')
const { resolveAppRoute } = require('./app-routes')
const { explain } = require('./compare')

const ROOT = path.resolve(__dirname, '../..')
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-screen-map.json'), 'utf8'))
const REPORT = path.join(__dirname, 'app-parity-report.json')
const OUT = path.join(__dirname, 'pairs', 'app')
const argv = process.argv.slice(2)
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)

function record(file) {
  const judged = JSON.parse(fs.readFileSync(file, 'utf8'))
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
  for (const row of report.screens) {
    const mine = judged
      .filter((j) => j.id === row.id)
      .map((j) => ({ type: 'picture', severity: 'medium', what: j.what, board: j.board, live: j.live }))
    const rules = (MAP.find((s) => s.id === row.id)?.explained || []).filter((r) => r.type === 'picture')
    const { findings, explained } = explain(mine, rules)
    row.findings = [...row.findings.filter((f) => f.type !== 'picture'), ...findings]
    row.explained = [...(row.explained || []).filter((f) => f.type !== 'picture'), ...explained]
  }
  const all = report.screens
  report.summary.findings = all.reduce((n, r) => n + r.findings.length, 0)
  report.summary.explained = all.reduce((n, r) => n + (r.explained?.length || 0), 0)
  report.summary.clean = all.filter((r) => !r.findings.length && !r.error).length
  report.summary.withFindings = all.filter((r) => r.findings.length).length
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1))
  console.log(JSON.stringify(report.summary, null, 1))
}

async function shoot() {
  const ids = flag('--id')?.split(',')
  const screens = MAP.filter((s) => !s.skip && (!ids || ids.includes(s.id)))
  const roles = [...new Set(screens.flatMap((s) => [s.role, s.seedRole]).filter(Boolean))]
  const users = roles.length ? await provision(roles) : {}
  const db = adminClient()
  fs.mkdirSync(OUT, { recursive: true })
  try {
    const seeded = roles.length ? await seed(db, users) : {}
    for (const role of ['guest', ...roles.filter((r) => screens.some((s) => (s.role || 'guest') === r))]) {
      const mine = screens.filter((s) => (s.role || 'guest') === role)
      if (!mine.length) continue
      const steps = [`appId: com.splatconnect.mobile`, `---`, `- runFlow: sign-in.yaml`]
      for (const s of mine) {
        const route = await resolveAppRoute(s, { seeded, db, cache: new Map() })
        if (!route) continue
        steps.push(`- openLink: "splatconnect:/${route}"`, `- waitForAnimationToEnd`, `- takeScreenshot: "${path.join(OUT, s.id)}.ios"`)
      }
      const flow = path.join(ROOT, 'packages/mobile/.maestro/parity', `_run-${role}.yaml`)
      fs.writeFileSync(flow, steps.join('\n') + '\n')
      const u = users[role]
      execFileSync('maestro', ['test', flow, '--env', `EMAIL=${u?.email || ''}`, '--env', `PASSWORD=${u?.password || ''}`], { stdio: 'inherit' })
      fs.unlinkSync(flow)
    }
  } finally {
    await unseed(db).catch(() => {})
    if (Object.keys(users).length) await cleanup(users)
  }
  execFileSync('python3', [path.join(__dirname, 'sidebyside.py'), '--dir', OUT, '--live-suffix', 'ios', '--out', path.join(__dirname, 'pairs', 'app-ios'), ...screens.map((s) => s.id)], { stdio: 'inherit' })
}

;(flag('--record') ? Promise.resolve(record(flag('--record'))) : shoot()).catch((e) => {
  console.error(e)
  process.exit(1)
})
```

`sidebyside.py` needs `--dir`, `--live-suffix` (default `live`) and `--out` (default `<dir>/sbs`). Add them with `argparse`, keeping the current defaults, so `python3 scripts/parity/sidebyside.py hub` still works for web. Board shots come from `app.js --shots` (`<id>.board.png` in the same folder), so run `app.js --shots` before `app-shots.js`. Add `.maestro/parity/_run-*.yaml` to `packages/mobile/.gitignore`.

- [ ] **Step 4: Shoot three screens**

Run: `node ../../scripts/parity/app.js --id guides,guide_detail,my_splat --shots && node ../../scripts/parity/app-shots.js --id guides,guide_detail,my_splat && ls ../../scripts/parity/pairs/app-ios/`
Expected: side-by-side PNGs for the three screens. Open one: the board on the left, the iOS app on the right, signed in, intro gone.

- [ ] **Step 5: Shoot everything and judge**

Run: `node ../../scripts/parity/app.js --shots && node ../../scripts/parity/app-shots.js`
Dispatch read-only agents, by group of about eight screens, with `scripts/parity/TRIAGE.md` and this instruction: compare `pairs/app-ios/<id>-*.png` for layout, safe area, sheet presentation, spacing and type rendering. Report only drift the numeric pass could not see. Output a JSON array `[{ "id", "what", "board", "live", "class" }]`, where `class` is one of `styling | pending | fixture | intended`. Write their combined output to `/private/tmp/claude-503/-Users-byronpetselis-Documents-splat-connect/b0fe4349-dbfc-4dfd-8f75-534114254cbd/scratchpad/picture-findings.json`.

- [ ] **Step 6: Record, close, re-shoot**

Run: `node ../../scripts/parity/app-shots.js --record /private/tmp/claude-503/-Users-byronpetselis-Documents-splat-connect/b0fe4349-dbfc-4dfd-8f75-534114254cbd/scratchpad/picture-findings.json`
Close each finding by the Task 6 Step 4 order: fix in `packages/mobile` with one commit per fix, or add a `picture` exemption (`{ "type": "picture", "match": "<what substring>", "why": …, "reason": … }`). Re-shoot the affected `--id`s, re-judge those, and re-record. Repeat until `--record` prints `"findings": 0`.

- [ ] **Step 7: Verify nothing else moved**

Stop the stack first (`./scripts/parity/stack.sh down`) before e2e, then run in order:
- `cd packages/mobile && npx jest --silent 2>&1 | tail -3`: all pass.
- `cd packages/mobile && ./node_modules/.bin/playwright test --reporter=line | tail -3`: all pass.
- `cd packages/mobile && maestro test .maestro/flows --env DEVICE_EMAIL=… --env DEVICE_PASSWORD=…` (credentials from `node scripts/provision-device-parent.mjs`): all flows pass.
- `./scripts/parity/stack.sh up && cd packages/web && node ../../scripts/parity/run.js | tail -8`: web still 118/118, 0 findings.
- `node scripts/parity/compare.test.js && node scripts/parity/fingerprint.test.js && node scripts/parity/app-map.test.js && node scripts/parity/app-routes.test.js`: all pass.
- `cd packages/api && npx vitest run tests/unit/pending-features.test.ts`: pass.

- [ ] **Step 8: Commit and push**

```bash
git add scripts/parity/app-shots.js scripts/parity/sidebyside.py packages/mobile/.maestro/parity/sign-in.yaml packages/mobile/.gitignore scripts/parity/app-parity-report.json scripts/parity/app-screen-map.json
git commit -m "feat(parity): the picture pass on the iOS simulator; mobile parity closed"
git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin development
```

Then update the project memory `artboard-parity-harness.md` with the app harness, its commands and any new self-measurement lessons.

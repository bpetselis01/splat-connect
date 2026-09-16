# Soft Pop — measured extraction from the artboard

**Source:** `Splat Connect frontend overhaul/SPLAT Connect - Web.dc.html` (1.4MB, 119 screens).
**Method:** served over `python3 -m http.server` and driven with Playwright. Values below are
`getComputedStyle` readings off the rendered prototype, not transcriptions of the markup.

**Read this file instead of the artboard.** The artboard is 1.4MB and its screens are gated by
`<sc-if>` conditionals, so reading it whole is not viable.

## How to open the prototype again

```bash
cd "Splat Connect frontend overhaul" && python3 -m http.server 8899 --bind 127.0.0.1
```

Then `http://127.0.0.1:8899/SPLAT%20Connect%20-%20Web.dc.html`. `file://` is blocked in Playwright.

Screens are **hash-addressable** — `…dc.html#states` opens Interaction states. The bottom-right
`button[aria-label="Prototype screens"]` opens a picker listing every screen with its route.
Switching by clicking a picker row works; `window.__dcSetProps({is_home:false, …})` does **not**.

---

## 1. Tokens

Defined on `body`, not `:root` — a `:root` selector finds nothing.

```css
--canvas:#faf9f7; --surface:#ffffff; --surface2:#f3f1ed; --ink:#1c2530;
--muted:#5a6675; --line:rgba(28,37,48,.09); --bw:1px;
--brand:#1998d5; --b600:#1179b0; --b700:#0f5f8c; --b100:#dcf0fb; --b50:#f0f9ff;
--onbrand:#ffffff; --focus:#1c2530;
--coral:#ff8a5c; --amber:#ffb020; --violet:#8b6df0; --mint:#12b3a6;
--ok:#2f9e6b; --warn:#e8a317; --bad:#e05252;
--tcoral:#ffe9de; --tmint:#d9f4f1; --tamber:#fff0cc; --tviolet:#ece6fc;
--tok:#dff3ea; --tbad:#fde3e3; --tink:#1c2530;
--e1:0 1px 2px rgba(28,37,48,.06);
--e2:0 4px 12px rgba(28,37,48,.08);
--e3:0 12px 28px rgba(28,37,48,.10);
--e4:0 24px 48px rgba(28,37,48,.14);
--glow:0 8px 20px rgba(25,152,213,.28);
--hi:inset 0 1px 0 rgba(255,255,255,.7);
```

**Two tokens the brief's §4 list omits:** `--warn` (#e8a317, distinct from the `--amber` accent)
and `--tbad` (#fde3e3, the destructive tint). Both are used. `--bw` is a border *width* token,
which is how high-contrast mode thickens every edge at once.

### Dark and high-contrast modes exist, and the brief never mentions them

`body[data-mode="dark"]` and `body[data-mode="hc"]` each redefine the full set. The header carries
three live toggles for them. Board wins over spec, so both are in scope.

```css
/* dark */
--canvas:#141a21; --surface:#1c242e; --surface2:#243040; --ink:#e7edf2; --muted:#a3afbc;
--line:rgba(231,237,242,.12); --brand:#4fb4e6; --b600:#4fb4e6; --b700:#87cdf0;
--b100:#124f73; --b50:#0d2a3f; --onbrand:#0d2a3f; --focus:#e7edf2;
--tcoral:#4a2a1c; --tmint:#123d3a; --tamber:#4a3810; --tviolet:#2e2650;
--tok:#173f2e; --tbad:#4a1f1f; --tink:#e7edf2;
--e1:0 1px 2px rgba(0,0,0,.3);  --e2:0 4px 12px rgba(0,0,0,.35);
--e3:0 12px 28px rgba(0,0,0,.4); --e4:0 24px 48px rgba(0,0,0,.5);
--glow:0 8px 20px rgba(79,180,230,.25); --hi:inset 0 1px 0 rgba(255,255,255,.08);

/* high contrast */
--canvas:#fff; --surface:#fff; --surface2:#f2f2f2; --ink:#000; --muted:#2b3440;
--line:#000; --bw:2px; --brand:#0f5f8c; --b600:#0f5f8c; --b700:#0d2a3f;
--b100:#e6f2fb; --b50:#fff; --onbrand:#fff; --focus:#000; --tink:#000;
--e1:none; --e2:none; --e3:none; --e4:none; --glow:none; --hi:none;
```

Note what high contrast does: every elevation becomes `none` and `--bw` doubles. Depth is carried
by borders there, not shadow — so any component that relies on shadow alone to separate from its
background disappears in that mode. Test it.

### Fonts

```
Baloo 2       600;700;800   display / headings
Nunito        400;500;600;700;800   UI text, card titles
JetBrains Mono 400;500   numerics, with font-variant-numeric: tabular-nums
```

---

## 2. Control states, measured

Every value below is computed off the live `/design-system/states` screen.

### Primary button
| State | height | background | colour | shadow | note |
|---|---|---|---|---|---|
| default | 48 | `--b600` #1179b0 | #fff | `--glow`,`--hi` | |
| hover | 48 | `--b600` | #fff | yes | |
| focus | 48 | `--b600` | #fff | yes | `outline:3px solid var(--focus); outline-offset:2px` |
| active | **46** | `--b600` | #fff | yes | `transform:scale(.96)` — 48 × .96 = 46 |
| disabled | 48 | `--surface2` | `--muted` | none | `opacity:.7` |
| loading | 48 | `--b700` #0f5f8c | #fff | none | label becomes "Sending…" |

### Secondary button
default/hover/focus 48px, `--surface` bg, `--ink` text, `1px solid --line`, `--e1`.
Active **46px**, bg `--surface2`, shadow dropped. Disabled `--muted` text, `opacity:.6`, no shadow.

### Destructive
`--surface` bg, `--bad` #e05252 text, `--line` border, `--e1`. Hover fills `--tbad` #fde3e3.
Focus takes the same ink outline. Never the default focus target.

### Filter chip
Off: `--surface`, `--ink`, `1px solid --line`, **no shadow**.
On: `--b600` fill, `#fff`, no border.
Focus: border becomes `--brand` #1998d5.

### Status pill (read-only — tint carries meaning, text repeats it)
| Pill | background | text |
|---|---|---|
| Published | `--tok` #dff3ea | `--ink` |
| Pending | `--tamber` #fff0cc | `--ink` |
| Returned | `--tbad` #fde3e3 | `--ink` |
| Draft | `--surface2` #f3f1ed | `--muted` |

### Press motion replaces Pixel's entirely

Soft Pop presses with `transform:scale(.96)` and drops the shadow. Pixel's rule — everything pops
up 2px on hover and travels down by its rest depth on click, with shadow arithmetic — is gone.
`scale(.96)` is already what `packages/mobile/lib/theme.ts` sets as `motion.pressScale`, so the two
platforms agree for the first time.

`press-motion.test.ts` must be rewritten to guard the new rule, not deleted: the bug it was written
for (Tailwind compiling a comma-separated selector group into `:is()`, which takes its most
specific argument's specificity, silently zeroing every press) is a CSS-authoring hazard that has
nothing to do with which design system is live.

---

## 3. Route map: 119 prototype screens vs 80 repo routes

Full machine-readable list: `.playwright-mcp/screen-routes.json`.

Matched with dynamic-segment awareness (an existing `[id]` route satisfies a concrete prototype
path), **71 screens have a route and 48 do not**. Of those 48, some are renames rather than new
work — check before scoping:

| Prototype | Repo today | Kind |
|---|---|---|
| `/toys`, `/toys/[id]` | `/toy-library`, `/toy-library/[id]` | rename + redirect |
| `/learn/ask` | `/learn/ask-an-expert` | rename |
| `/learn/safe-handling` | `/learn/safety-and-cleaning` | probable rename — confirm copy |
| `/tutorials` | *(only `/tutorials/[id]` exists)* | genuinely new index |

### Genuinely new, grouped

- **`/learn` (13)** — the course goes from 6 lessons to 19: `how-a-switch-works`,
  `wire-a-connector`, `build-a-switch`, three named builds (`hamster-mania`, `duck-bubbles`,
  `ms-rachel`), four checkpoints, `handover`, `ask`. This is a **content** project, not a restyle;
  `uploads/` holds the workshop printout and the Ms Rachel maker guide it is presumably drawn from.
- **`/dashboard` (12)** — `printers`, `printers/new`, `print-requests/[id]`, `exchanges/build/[id]`,
  `events`, and six organisation screens (`profile`, `publish`, `requests`, `recycling`,
  `events/new`, `stories/new`).
- **`/get-involved` (8)** — events ×3, makers-wanted ×2, recycling ×2, organisations/request.
- **`/admin` (5)** — `inbox`, `build-requests`, `print-jobs`, `reports`, `content`.
- **`/about/stories` (2)**, **`/design-system` (2)**, `/onboarding/child`, `/printing/request`,
  `/toys/[id]/request`.

The brief's 12 features cover a fraction of this. Its feature list is a sensible order to start in,
not the full scope.

---

## 4. Things to carry into F1

- Tokens go on `body` (or `:root` — but the mode variants key off `body[data-mode]`, so match that).
- `--bw` must be a token, not a literal `1px`, or high-contrast mode cannot thicken edges.
- Elevations are the *only* depth; in high contrast they all become `none`, so never rely on a
  shadow to do a border's job.
- Every interactive element takes `outline:3px solid var(--focus); outline-offset:2px` on focus.
- `transform:scale(.96)` on `:active`, shadow dropped.
- Status pills are read-only. The tint is redundant with the label by design — do not remove the
  word and leave only colour.

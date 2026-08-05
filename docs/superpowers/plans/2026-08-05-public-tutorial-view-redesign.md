# Public Tutorial View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the public tutorial detail page (`/tutorials/[id]`) into a sticky desktop rail (photo/title/badges/CTA) plus a plain, decluttered reference column (Parts/Tools/Files), replacing today's cards-on-canvas list and emoji headers.

**Architecture:** Single-file change: `packages/web/app/tutorials/[id]/page.tsx` restructures its JSX into two grid regions (left column gets `md:sticky`, right column gets three plain-divider list sections). Two small CSS primitives (`.ref-section`, `.ref-row`) are added to `globals.css`, composed with the existing `.card-flat` class. No new components, no API/type changes, no changes below the `md:` breakpoint's DOM order (already correct via existing `grid-cols-1` stacking).

**Tech Stack:** Next.js (App Router, RSC), Tailwind v4 (`@theme`/`@layer` in `globals.css`), Playwright for e2e.

## Global Constraints

- Scope is exactly `packages/web/app/tutorials/[id]/page.tsx` and `packages/web/app/globals.css`. Do not touch `packages/mobile` or any API route.
- No new npm dependencies, no new React components — reuse existing `DifficultyBadge`, `OrgBadges`, `FileText`/`Download` icons, and CSS primitives (`.card-flat`, `.badge`, `.btn`).
- Sticky rail applies only at `md:` and above; below `md:` the page must render as a single-column stack in this exact order: photo → title/badges/backing/contributors → description → Download button → Parts → Tools → Files.
- Section headers drop emoji ("🔩 Parts needed" → "Parts needed", "🔧 Tools needed" → "Tools needed"). "Files for 3D printing" wording is unchanged.

---

### Task 1: Restructure the tutorial detail page

**Files:**
- Modify: `packages/web/app/tutorials/[id]/page.tsx` (full rewrite of the returned JSX)
- Modify: `packages/web/app/globals.css:522-533` (insert new primitives before the `@layer components` closing brace, right after the existing `.empty-badge` block)
- Modify: `packages/web/tests/e2e/public/tutorial-detail.spec.ts:21` and `:25`

**Interfaces:**
- Consumes: `TutorialWithDetails` (from `@splat-connect/types`), `DifficultyBadge` (`packages/web/components/difficulty-badge.tsx`), `OrgBadges` (`packages/web/components/org-badges.tsx`), `FileText`/`Download` (`packages/web/components/icons.tsx`) — all unchanged, imported as before.
- Produces: no new exports. The page's rendered DOM headings change from `'🔩 Parts needed'`/`'🔧 Tools needed'` to `'Parts needed'`/`'Tools needed'` — later tasks (none in this plan) and the e2e spec below depend on this exact text.

- [ ] **Step 1: Update the e2e spec's heading assertions (red step)**

Edit `packages/web/tests/e2e/public/tutorial-detail.spec.ts`:

```ts
  await expect(page.getByRole('heading', { name: 'Parts needed' })).toBeVisible()
  await expect(page.getByText(/E2E part\s*×\s*2/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buy E2E part from Jaycar' })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Tools needed' })).toBeVisible()
```

(Replaces the `'🔩 Parts needed'` and `'🔧 Tools needed'` heading names on lines 21 and 25 — every other line in the file is unchanged.)

- [ ] **Step 2: Run the e2e spec and confirm it fails**

```bash
cd packages/web && npx playwright test tests/e2e/public/tutorial-detail.spec.ts
```

Expected: FAIL — the first test can't find a heading named `Parts needed` (the page still renders `🔩 Parts needed`).

- [ ] **Step 3: Add the reference-list CSS primitives**

In `packages/web/app/globals.css`, insert this block immediately after the `.empty-badge` rule (before the `@layer components` block's closing `}` on line 533):

```css

  /* --- Reference list (public tutorial page) ---------------------------- */
  .ref-section {
    padding: 1rem 1.25rem;
  }

  .ref-row {
    display: block;
    padding: 0.625rem 0;
    border-bottom: 1px solid var(--color-line);
  }

  .ref-row:last-child {
    border-bottom: none;
  }
```

- [ ] **Step 4: Rewrite the page component**

Replace the full contents of `packages/web/app/tutorials/[id]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { OrgBadges } from '@/components/org-badges'
import { FileText, Download } from '@/components/icons'
import type { TutorialWithDetails, TutorialOrg } from '@splat-connect/types'

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await fetch(`${process.env.API_URL}/api/public/tutorials/${id}`, { cache: 'no-store' })
  if (!res.ok) notFound()

  // The public endpoint embeds accepted backing and the approver, so a logged-out
  // parent gets them without a second, authenticated call.
  const tutorial = (await res.json()) as TutorialWithDetails & {
    tutorial_orgs?: TutorialOrg[]
    reviewer?: { name: string } | null
    reviewed_for?: { name: string } | null
  }

  const contributors = tutorial.tutorial_contributors ?? []
  const primaryContributor = contributors.find((c) => c.role === 'primary')
  const collaborators = contributors.filter((c) => c.role === 'collaborator')

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {/* Sticky rail: the "can I do this" verdict, pinned while the reference
          column scrolls. md:self-start keeps the box at its own content height
          inside the stretched grid row, which is what lets it un-stick once its
          own bottom edge (not the row's) scrolls past. */}
      <div className="md:sticky md:top-20 md:self-start">
        {tutorial.toy_photo_url ? (
          <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-sunken">
            <Image
              src={tutorial.toy_photo_url}
              alt={tutorial.title}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-2xl bg-brand-tint text-6xl">
            🧸
          </div>
        )}
        <OrgBadges
          backing={tutorial.tutorial_orgs ?? []}
          approvedByName={tutorial.reviewer?.name}
          approvedForOrgName={tutorial.reviewed_for?.name}
        />
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-ink">{tutorial.title}</h1>
            <DifficultyBadge difficulty={tutorial.difficulty} />
          </div>
          {tutorial.description && (
            <p className="max-w-prose text-sm leading-relaxed text-muted">
              {tutorial.description}
            </p>
          )}
          {contributors.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              By{' '}
              {[primaryContributor, ...collaborators]
                .filter(Boolean)
                .map((c) => c!.profiles?.name)
                .filter((name): name is string => Boolean(name))
                .join(', ')}
            </p>
          )}
        </div>
        {tutorial.tutorial_pdf_url && (
          <a
            href={tutorial.tutorial_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-block mt-6"
          >
            <FileText /> Download Tutorial PDF
          </a>
        )}
      </div>

      {/* Reference column: Parts, Tools, Files — the build-time reference list.
          Plain divided rows (.ref-row) instead of one .card per item, so the
          list doesn't compete visually with the rail's single action card. */}
      <div className="flex flex-col gap-6">
        {tutorial.parts.length > 0 && (
          <div className="card-flat ref-section">
            <h2 className="mb-1 text-sm font-bold text-ink">Parts needed</h2>
            {tutorial.parts.map((p) => (
              <div key={p.id} className="ref-row text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink">
                    <strong>{p.name}</strong> × {p.quantity}
                  </span>
                  {p.is_optional && (
                    <span className="badge shrink-0 bg-sunken text-brand-deep">
                      Optional
                    </span>
                  )}
                </div>
                {p.buy_links.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-3">
                    {p.buy_links.map((bl, i) => (
                      <a
                        key={i}
                        href={bl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buy ${p.name} from ${bl.label}`}
                        className="text-xs font-semibold text-brand-dark hover:underline"
                      >
                        {bl.label || 'Buy →'}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {tutorial.tools.length > 0 && (
          <div className="card-flat ref-section">
            <h2 className="mb-1 text-sm font-bold text-ink">Tools needed</h2>
            {tutorial.tools.map((t) => (
              <div key={t.id} className="ref-row text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink">
                    <strong>{t.name}</strong>
                  </span>
                  {t.is_optional && (
                    <span className="badge shrink-0 bg-sunken text-brand-deep">
                      Optional
                    </span>
                  )}
                </div>
                {t.buy_links.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-3">
                    {t.buy_links.map((bl, i) => (
                      <a
                        key={i}
                        href={bl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buy ${t.name} from ${bl.label}`}
                        className="text-xs font-semibold text-brand-dark hover:underline"
                      >
                        {bl.label || 'Buy →'}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {tutorial.stl_files.length > 0 && (
          <div className="card-flat ref-section">
            <h2 className="mb-1 text-sm font-bold text-ink">Files for 3D printing</h2>
            {tutorial.stl_files.map((f) => (
              <a
                key={f.id}
                href={f.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ref-row flex items-center gap-2 text-sm font-semibold text-brand-dark hover:underline"
              >
                <Download /> {f.filename}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the e2e spec and confirm it passes**

```bash
cd packages/web && npx playwright test tests/e2e/public/tutorial-detail.spec.ts
```

Expected: PASS — all 5 tests in the file green.

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/tutorials/[id]/page.tsx packages/web/app/globals.css packages/web/tests/e2e/public/tutorial-detail.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): restructure public tutorial page into sticky rail + reference list

Left column becomes a sticky verdict rail (photo, title, badges, backing,
description, PDF download) that stays pinned while the right column's
Parts/Tools/Files reference list scrolls. Replaces per-item cards-on-canvas
with plain divided rows and drops the emoji section headers.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Full verification pass

**Files:** none (verification only)

**Interfaces:**
- Consumes: the finished Task 1 change. No new interfaces.

- [ ] **Step 1: Typecheck**

```bash
cd packages/web && npm run typecheck
```

Expected: PASS, no errors.

- [ ] **Step 2: Lint**

```bash
cd packages/web && npm run lint
```

Expected: PASS, no errors.

- [ ] **Step 3: Full unit suite**

```bash
cd packages/web && npm run test:unit
```

Expected: PASS. (No unit test targets this page directly, but this confirms the change didn't break `difficulty-badge`/`org-badges`/`icons` consumers elsewhere.)

- [ ] **Step 4: Full e2e suite for the public tutorial pages**

```bash
cd packages/web && npx playwright test tests/e2e/public/
```

Expected: PASS.

- [ ] **Step 5: Manual browser check**

With the dev server running on `http://localhost:3100` (already up per the current session), open a real approved tutorial's detail page, e.g. `http://localhost:3100/tutorials/<an-approved-id>`, and confirm:
- Desktop width (≥768px): left rail (photo/title/badges/CTA) stays pinned in view while scrolling the Parts/Tools/Files list on the right, and un-pins once its own bottom edge is reached.
- Narrow width (<768px, resize the window or use device toolbar): everything stacks in one column, no stickiness, Files appears after Tools.
- No emoji before "Parts needed" / "Tools needed".
- Parts/Tools/Files render as a plain divided list (no boxed card per item), inside one bordered container per section.

If anything looks off, fix it before moving on — this is the only step in the plan that catches a visual regression the automated checks can't.

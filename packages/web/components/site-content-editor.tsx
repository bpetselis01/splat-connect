'use client'
/**
 * Site content — the pages with no other owner.
 *
 * Four tabs, and only two of them are editable here. That is not an omission,
 * it is the honest split:
 *
 * - **Home page** and **About pages** are copy. They live in site_content (065)
 *   and this edits them.
 * - **Learn course** is nineteen lesson pages of prose, diagrams and
 *   checkpoints. Their ORDER is content; their bodies are not, and an editor
 *   that pretended otherwise would be a worse text editor than a file.
 * - **Legal** is the four documents, and their bodies stay in files on purpose.
 *   What is editable here is the thing that actually changes and has to be
 *   recorded: the version and the effective date. The artboard is explicit that
 *   "legal edits can force re-acceptance, so that is a deliberate toggle rather
 *   than a side effect", and a toggle that re-prompts every contributor is not
 *   something to hang off an autosaving textarea.
 *
 * The three home numbers default to being COUNTED. Pinning one is a deliberate
 * act with a source line beside it, because — the artboard's words — "a pinned
 * number is a claim someone has to stand behind".
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FloppyDisk, Warning } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { ProfileTabs } from '@/components/profile-tabs'

export type ContentRow = { key: string; value: Record<string, unknown>; updated_at: string }

type Hero = {
  eyebrow: string
  headline: string
  subhead: string
  primary_label: string
  secondary_label: string
}

type NumberSpec = { label: string; live: boolean; pinned: number | null; source: string }
type Numbers = Record<'guides' | 'organisations' | 'toys', NumberSpec>

const HERO_FIELDS: Array<{ key: keyof Hero; label: string }> = [
  { key: 'eyebrow', label: 'Eyebrow' },
  { key: 'headline', label: 'Headline' },
  { key: 'subhead', label: 'Subhead' },
  { key: 'primary_label', label: 'First button' },
  { key: 'secondary_label', label: 'Second button' },
]

const LEGAL = [
  { href: '/terms', label: 'Terms of use' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/legal/contributor-terms', label: 'Contributor terms' },
  { href: '/legal/org-leader-terms', label: 'Organisation leader terms' },
] as const

const EMPTY_HERO: Hero = {
  eyebrow: '',
  headline: '',
  subhead: '',
  primary_label: '',
  secondary_label: '',
}

/**
 * Module scope, not inside the editor.
 *
 * A component declared inside a render is a new type on every pass, so React
 * unmounts and remounts its whole subtree — which on a form means a text field
 * losing focus mid-word. Same rule as components/printer-row.tsx's JobRow
 * (react-hooks/static-components).
 */
function SaveButton({
  label,
  saving,
  saved,
  onSave,
}: {
  label: string
  saving: boolean
  saved: boolean
  onSave: () => void
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button type="button" onClick={onSave} disabled={saving} className="btn btn-primary btn-sm">
        <FloppyDisk className="h-4 w-4" aria-hidden="true" />
        {saving ? 'Saving…' : `Save ${label}`}
      </button>
      {saved && <span className="text-sm font-semibold text-muted">Saved</span>}
    </div>
  )
}

export function SiteContentEditor({ rows }: { rows: ContentRow[] }) {
  const router = useRouter()
  const byKey = new Map(rows.map((r) => [r.key, r.value]))

  const [hero, setHero] = useState<Hero>({
    ...EMPTY_HERO,
    ...((byKey.get('home-hero') ?? {}) as Partial<Hero>),
  })
  const [numbers, setNumbers] = useState<Numbers>(
    (byKey.get('home-numbers') ?? {}) as Numbers
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function save(key: string, value: unknown) {
    setError(null)
    setSaved(null)
    setSaving(key)
    try {
      await browserApiClient.put(`/api/admin/content/${key}`, { value })
      setSaved(key)
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="alert alert-danger mb-4">
          {error}
        </p>
      )}

      <ProfileTabs
        tabs={[
          {
            key: 'home',
            label: 'Home page',
            content: (
              <div className="flex flex-col gap-6">
                <section className="card p-5">
                  <h2 className="font-display text-xl font-extrabold text-ink">The opening</h2>
                  <div className="mt-3 flex flex-col gap-4">
                    {HERO_FIELDS.map((f) => (
                      <label key={f.key} className="block">
                        <span className="mb-1.5 block text-sm font-bold text-ink">{f.label}</span>
                        {f.key === 'subhead' ? (
                          <textarea
                            value={hero[f.key]}
                            onChange={(e) => setHero({ ...hero, [f.key]: e.target.value })}
                            rows={3}
                            className="field"
                          />
                        ) : (
                          <input
                            value={hero[f.key]}
                            onChange={(e) => setHero({ ...hero, [f.key]: e.target.value })}
                            className="field"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                  <SaveButton
                    label="the opening"
                    saving={saving === 'home-hero'}
                    saved={saved === 'home-hero'}
                    onSave={() => save('home-hero', hero)}
                  />
                </section>

                <section className="card p-5">
                  <h2 className="font-display text-xl font-extrabold text-ink">The three numbers</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Counted live by default. Pin one only if the live count is wrong or
                    embarrassing, and say so in the source line — a pinned number is a claim
                    someone has to stand behind.
                  </p>
                  <ul className="mt-3 flex list-none flex-col gap-3">
                    {(Object.keys(numbers) as Array<keyof Numbers>).map((k) => {
                      const spec = numbers[k]
                      if (!spec) return null
                      return (
                        <li
                          key={k}
                          className="flex flex-wrap items-center gap-3 rounded-card border border-line p-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-ink">{spec.label}</span>
                            <input
                              aria-label={`${spec.label} source`}
                              value={spec.source}
                              onChange={(e) =>
                                setNumbers({ ...numbers, [k]: { ...spec, source: e.target.value } })
                              }
                              className="field mt-1 text-xs"
                            />
                          </span>
                          {!spec.live && (
                            <input
                              type="number"
                              aria-label={`${spec.label} value`}
                              value={spec.pinned ?? ''}
                              onChange={(e) =>
                                setNumbers({
                                  ...numbers,
                                  [k]: {
                                    ...spec,
                                    pinned: e.target.value === '' ? null : Number(e.target.value),
                                  },
                                })
                              }
                              className="field w-24 font-mono tabular-nums"
                            />
                          )}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={spec.live}
                            onClick={() =>
                              setNumbers({ ...numbers, [k]: { ...spec, live: !spec.live } })
                            }
                            // aria-checked, not aria-pressed: role="switch"
                            // does not support the latter, and two conflicting
                            // states is worse than one.
                            className="chip"
                            data-on={spec.live ? 'true' : undefined}
                          >
                            {spec.live ? 'Counted live' : 'Pinned by hand'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <SaveButton
                    label="the numbers"
                    saving={saving === 'home-numbers'}
                    saved={saved === 'home-numbers'}
                    onSave={() => save('home-numbers', numbers)}
                  />
                </section>
              </div>
            ),
          },
          {
            key: 'about',
            label: 'About pages',
            content: (
              <p className="card p-5 text-sm leading-relaxed text-muted">
                The team and partner lists are the next section to move here. They are file-owned
                for now —{' '}
                <Link href="/about/team" className="font-semibold text-brand-dark hover:underline">
                  Our team
                </Link>{' '}
                and{' '}
                <Link
                  href="/about/partners"
                  className="font-semibold text-brand-dark hover:underline"
                >
                  Partners
                </Link>{' '}
                — and this tab exists so that is visible rather than assumed.
              </p>
            ),
          },
          {
            key: 'learn',
            label: 'Learn course',
            content: (
              <p className="card p-5 text-sm leading-relaxed text-muted">
                The course outline lives in <code>lib/learn-course.ts</code>, which is what both
                the{' '}
                <Link href="/learn" className="font-semibold text-brand-dark hover:underline">
                  course home
                </Link>{' '}
                and every lesson&apos;s sidebar read. The ORDER is content and belongs here
                eventually; the nineteen lesson bodies are prose, diagrams and checkpoints, and an
                editor for those would be a worse text editor than a file.
              </p>
            ),
          },
          {
            key: 'legal',
            label: 'Legal',
            content: (
              <div className="card p-5">
                <p className="flex items-start gap-2 text-sm leading-relaxed text-muted">
                  <Warning className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                  The four documents stay in files. Editing one can force every contributor to
                  accept it again, which is a deliberate act with a version behind it — not
                  something to hang off a textarea that autosaves.
                </p>
                <ul className="mt-4 flex list-none flex-col gap-2">
                  {LEGAL.map((doc) => (
                    <li key={doc.href} className="flex items-center justify-between gap-3">
                      <span className="font-bold text-ink">{doc.label}</span>
                      <Link href={doc.href} className="btn btn-quiet btn-sm">
                        Read it
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

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
import {
  Check,
  GraduationCap,
  House,
  Lightning,
  PencilSimple,
  Scroll,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { ProfileTabs } from '@/components/profile-tabs'
import { SCENES } from '@/components/scroll-world'

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

/** One beat of the homepage flight: its place, and the line said over it. */
type SceneRow = { title: string; line: string }

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

// The board's section card and its heading, shared by every tab.
const SECTION = 'flex flex-col gap-3.5 rounded-card border-[length:var(--bw)] border-line bg-surface p-[22px] shadow-[var(--shadow-e2),var(--shadow-hi)]'
const SECTION_H = 'm-0 font-display text-[22px] font-extrabold text-ink'
const SECTION_P = 'mt-1.5 max-w-[62ch] text-sm leading-normal text-muted'
const LABEL = 'mb-[7px] block text-sm font-extrabold text-ink'
const INPUT = 'field h-[50px] bg-canvas'

// The five the homepage is flying through right now — components/scroll-world.
// Editing one here does not move the page yet; that is the same shape as the
// hero and the numbers, which also write site_content ahead of a public reader.
const LIVE_SCENES: SceneRow[] = SCENES.map((s) => ({ title: s.place, line: s.title }))

const EMPTY_HERO: Hero = {
  eyebrow: '',
  headline: '',
  subhead: '',
  primary_label: '',
  secondary_label: '',
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
  const [scenes, setScenes] = useState<SceneRow[]>(
    ((byKey.get('home-scenes') as { scenes?: SceneRow[] } | undefined)?.scenes ?? LIVE_SCENES)
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // The board's one "Save changes" saves the section you are in — on the
  // home tab, that is both rows.
  async function saveHome() {
    setError(null)
    setSaved(null)
    setSaving('home')
    try {
      await browserApiClient.put('/api/admin/content/home-hero', { value: hero })
      await browserApiClient.put('/api/admin/content/home-numbers', { value: numbers })
      await browserApiClient.put('/api/admin/content/home-scenes', { value: { scenes } })
      setSaved('home')
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setSaving(null)
    }
  }

  const heroField = (key: keyof Hero, label: string) => (
    <label key={key} className="block">
      <span className={LABEL}>{label}</span>
      {key === 'subhead' ? (
        <textarea
          value={hero[key]}
          onChange={(e) => setHero({ ...hero, [key]: e.target.value })}
          rows={2}
          className="field bg-canvas leading-[1.55]"
        />
      ) : (
        <input
          value={hero[key]}
          onChange={(e) => setHero({ ...hero, [key]: e.target.value })}
          className={INPUT}
        />
      )}
    </label>
  )
  const label = (key: keyof Hero) => HERO_FIELDS.find((f) => f.key === key)!.label

  return (
    <div>
      {error && (
        <p role="alert" className="alert alert-danger mb-4">
          {error}
        </p>
      )}

      <div className="mt-6">
        <ProfileTabs
          variant="segmented"
          label="Content sections"
          tabs={[
            {
              key: 'home',
              label: 'Home page',
              icon: <House size={18} weight="duotone" aria-hidden="true" />,
              content: (
                <div className="flex flex-col gap-5">
                  <section className={`${SECTION} gap-4`}>
                    <h2 className={SECTION_H}>The opening</h2>
                    <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
                      {heroField('eyebrow', label('eyebrow'))}
                      {heroField('headline', label('headline'))}
                    </div>
                    {heroField('subhead', label('subhead'))}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {heroField('primary_label', label('primary_label'))}
                      {heroField('secondary_label', label('secondary_label'))}
                    </div>
                  </section>

                  <section className={SECTION}>
                    <div>
                      <h2 className={SECTION_H}>The three numbers</h2>
                      <p className={SECTION_P}>
                        Counted live by default. Pin one only if the live count is wrong or
                        embarrassing, and say so in the source line — a pinned number is a claim
                        someone has to stand behind.
                      </p>
                    </div>
                    <ul className="flex list-none flex-col gap-2.5">
                      {(Object.keys(numbers) as Array<keyof Numbers>).map((k) => {
                        const spec = numbers[k]
                        if (!spec) return null
                        return (
                          <li
                            key={k}
                            className="flex flex-wrap items-center gap-3 rounded-[18px] border-2 px-4 py-3.5"
                            style={{
                              borderColor: spec.live ? 'var(--b600)' : 'var(--line)',
                              background: spec.live ? 'var(--b50)' : 'var(--canvas)',
                            }}
                          >
                            <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-[3px]">
                              <span className="text-[15px] font-extrabold text-ink">{spec.label}</span>
                              {/* The source line is only the admin's to write once
                                  the number is theirs; a counted one says where
                                  it is counted from. */}
                              {spec.live ? (
                                <span className="text-[13px] text-muted">{spec.source}</span>
                              ) : (
                                <input
                                  aria-label={`${spec.label} source`}
                                  value={spec.source}
                                  onChange={(e) =>
                                    setNumbers({ ...numbers, [k]: { ...spec, source: e.target.value } })
                                  }
                                  className="field min-h-9 bg-surface text-[13px]"
                                />
                              )}
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
                                className="field w-[100px] flex-none text-center text-[17px]"
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
                              className="btn btn-quiet btn-md flex-none text-[13px] shadow-none"
                            >
                              {spec.live ? (
                                <Lightning size={16} weight="bold" aria-hidden="true" className="text-[var(--b600)]" />
                              ) : (
                                <PencilSimple size={16} weight="bold" aria-hidden="true" className="text-[var(--b600)]" />
                              )}
                              {spec.live ? 'Counted live' : 'Pinned by hand'}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>

                  <section className={SECTION}>
                    <div>
                      <h2 className={SECTION_H}>The scroll story</h2>
                      <p className={SECTION_P}>
                        Five scenes, one per scroll beat. Keep each line to something a person
                        would actually say out loud.
                      </p>
                    </div>
                    <ul className="flex list-none flex-col gap-2.5">
                      {scenes.map((sc, i) => {
                        const set = (patch: Partial<SceneRow>) =>
                          setScenes(scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)))
                        return (
                          <li
                            key={i}
                            className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-[18px] border-[length:var(--bw)] border-line bg-canvas p-3.5"
                          >
                            <span
                              aria-hidden="true"
                              className="grid h-8 w-8 place-items-center rounded-[14px] bg-[var(--b100)] font-display text-sm font-extrabold text-[var(--b700)]"
                            >
                              {i + 1}
                            </span>
                            <span className="flex min-w-0 flex-col gap-2">
                              <input
                                aria-label={`Scene ${i + 1} title`}
                                value={sc.title}
                                onChange={(e) => set({ title: e.target.value })}
                                className="field h-[42px] bg-surface text-sm font-extrabold"
                              />
                              <input
                                aria-label={`Scene ${i + 1} line`}
                                value={sc.line}
                                onChange={(e) => set({ line: e.target.value })}
                                className="field h-10 bg-surface text-sm font-semibold"
                              />
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </section>

                  <div className="flex flex-wrap items-center gap-3 rounded-[18px] border-[length:var(--bw)] border-line bg-[var(--b50)] px-5 py-[18px]">
                    <button
                      type="button"
                      onClick={saveHome}
                      disabled={saving === 'home'}
                      className="btn btn-primary px-[26px]"
                    >
                      <Check size={18} weight="bold" aria-hidden="true" />
                      {saving === 'home' ? 'Saving…' : 'Save changes'}
                    </button>
                    <p className="min-w-[240px] flex-1 text-[13px] leading-normal text-muted">
                      {saved === 'home' ? (
                        <strong className="text-ink">Saved. </strong>
                      ) : null}
                      Saves the section you are in. Public pages pick it up straight away — there
                      is no second approver above an administrator, which is why every edit here
                      is logged against your account.
                    </p>
                  </div>
                </div>
              ),
            },
            {
              key: 'about',
              label: 'About pages',
              icon: <UsersThree size={18} weight="duotone" aria-hidden="true" />,
              content: (
                <section className={SECTION}>
                  <h2 className={SECTION_H}>Our team, partners and supporters</h2>
                  <p className="text-sm leading-relaxed text-muted">
                    The team and partner lists are the next section to move here. They are
                    file-owned for now —{' '}
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
                </section>
              ),
            },
            {
              key: 'learn',
              label: 'Learn course',
              icon: <GraduationCap size={18} weight="duotone" aria-hidden="true" />,
              content: (
                <section className={SECTION}>
                  <h2 className={SECTION_H}>The course</h2>
                  <p className="text-sm leading-relaxed text-muted">
                    The course outline lives in <code>lib/learn-course.ts</code>, which is what
                    both the{' '}
                    <Link href="/learn" className="font-semibold text-brand-dark hover:underline">
                      course home
                    </Link>{' '}
                    and every lesson&apos;s sidebar read. The ORDER is content and belongs here
                    eventually; the nineteen lesson bodies are prose, diagrams and checkpoints, and
                    an editor for those would be a worse text editor than a file.
                  </p>
                </section>
              ),
            },
            {
              key: 'legal',
              label: 'Legal',
              icon: <Scroll size={18} weight="duotone" aria-hidden="true" />,
              content: (
                <div className="flex flex-col gap-5">
                  <div className="flex items-start gap-3.5 rounded-card border-[length:var(--bw)] border-line bg-[var(--tamber)] px-5 py-[18px]">
                    <Scroll size={28} weight="duotone" aria-hidden="true" className="flex-none text-ink" />
                    <p className="text-sm leading-[1.55] text-ink">
                      The four documents stay in files. Editing one can force every contributor to
                      accept it again, which is a deliberate act with a version behind it — not
                      something to hang off a textarea that autosaves.
                    </p>
                  </div>
                  {LEGAL.map((doc) => (
                    <section key={doc.href} className={SECTION}>
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <h2 className="m-0 font-display text-xl font-extrabold text-ink">{doc.label}</h2>
                        <span className="font-mono text-[12.5px] font-semibold text-muted">{doc.href}</span>
                      </div>
                      <Link href={doc.href} className="btn btn-quiet btn-md self-start">
                        Read it
                      </Link>
                    </section>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

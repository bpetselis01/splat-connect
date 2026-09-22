/**
 * The public face of a tutorial, as one component.
 *
 * There were three renderings of this: the public page, the leader's project
 * page and the admin's review page. Only the public one was ever designed --
 * the review screens grew their own markup (a raw `rounded` image, a bare blue
 * <a> for the PDF, parts as flat rows with a count in the heading, no files at
 * all on the leader's), so a reviewer judged a page that looked nothing like
 * the one they were publishing. There is one rendering now, and the review
 * pages wrap it rather than reinvent it.
 *
 * Presentational only. Every caller has already fetched the tutorial -- the
 * public page from /api/public/tutorials/:id, the two review pages from the
 * authenticated /api/tutorials/:id, which embeds the same parts, tools, files
 * and contributors.
 *
 * `actions` is the only slot: the public page puts Save / Share / Thanks under
 * the rail's primary button, as the board does, and a reviewer has nothing to
 * save.
 *
 * The board's guide has a Steps tab and a Community notes tab. Neither exists
 * in this schema — the steps live in the PDF — so the tabs drawn here are the
 * ones the data can fill: Parts & tools, Files (assistive tech only) and
 * Safety (once the author has affirmed the checklist).
 *
 * Related files:
 * - app/tutorials/[id]/page.tsx: the public page this was lifted from
 * - app/organizations/[id]/projects/[tutorialId]/page.tsx: leader review
 * - app/admin/review/[id]/page.tsx: admin review
 * - app/files/[bucket]/[...path]/route.ts: where the file links go
 */
import type { ReactNode } from 'react'
import { NotMedicalNote } from '@/components/not-medical-note'
import { PhotoCarousel } from '@/components/photo-carousel'
import { SectionTabs } from '@/components/section-tabs'
import { DIFFICULTY } from '@/components/tutorial-card'
import { tintFor } from '@/components/card-photo'
import { BoundaryLink } from '@/components/boundary-link'
import { FileText } from '@/components/icons'
import Link from 'next/link'
import {
  ArrowSquareOut,
  CheckCircle,
  Cube,
  DownloadSimple,
  HandHeart,
  HandTap,
  Lifebuoy,
  Printer,
  SealCheck,
  ShieldCheck,
  Wrench,
} from '@phosphor-icons/react/dist/ssr'
import {
  KIND_LABEL,
  MATURITY_LABEL,
  SAFETY_CHECKLIST,
  formatBuildTime,
  type BuyLink,
  type TutorialWithDetails,
  type TutorialOrg,
} from '@splat-connect/types'
import { agoInWords } from '@/lib/relative-time'
import { longDate } from '@/lib/dates'

type Viewable = TutorialWithDetails & {
  tutorial_orgs?: TutorialOrg[]
  reviewer?: { name: string } | null
  reviewed_for?: { name: string } | null
}

/** "A, B and C" — the board's byline joins names the way a person would. */
function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function BuyLinks({ item, links }: { item: string; links: BuyLink[] }) {
  if (links.length === 0) return null
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {links.map((bl, i) => (
        <a
          key={i}
          href={bl.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Buy ${item} from ${bl.label}`}
          className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-brand-deep hover:underline"
        >
          {bl.label || 'Buy'} <ArrowSquareOut size={14} aria-hidden="true" />
        </a>
      ))}
    </span>
  )
}

export function TutorialView({
  tutorial,
  backing,
  actions,
  signedIn,
}: {
  tutorial: Viewable
  /** The leader page fetches backing separately; everyone else has it embedded. */
  backing?: TutorialOrg[]
  /** Under the rail's primary button: the public page's Save / Share / Thanks. */
  actions?: ReactNode
  /**
   * Whether file links go to /files (signs on click) or to signup. Required,
   * not defaulted: a gate that defaults open is the wrong default, and there
   * are three callers.
   */
  signedIn: boolean
}) {
  const contributors = tutorial.tutorial_contributors ?? []
  const primaryContributor = contributors.find((c) => c.role === 'primary')
  const collaborators = contributors.filter((c) => c.role === 'collaborator')

  // A signed-out visitor is sent to sign up from the same <a>; the route
  // handler behind /files would do the same, but the page already knows and
  // should not hand out a link it knows will bounce.
  const signupHref = `/signup?next=${encodeURIComponent(`/tutorials/${tutorial.id}`)}&reason=download`
  const fileHref = (bucket: 'tutorial-pdfs' | 'stl-files', path: string) =>
    signedIn ? `/files/${bucket}/${path}` : signupHref
  // Only a link to a file opens in a new tab; the signup detour is this tab.
  const newTab = signedIn ? { target: '_blank', rel: 'noopener noreferrer' } : {}

  const authors = [primaryContributor, ...collaborators]
    .filter(Boolean)
    .map((c) => c!.profiles?.name)
    .filter((name): name is string => Boolean(name))

  // Only ACCEPTED backing is ever public: an organisation's mark belongs only
  // where one of its leaders put it. The API filters too; this is belt and
  // braces, as it was in the OrgBadges component this replaces.
  const backers = (backing ?? tutorial.tutorial_orgs ?? [])
    .filter((b) => b.status === 'accepted')
    .map((b) => b.organizations?.name)
    .filter((name): name is string => Boolean(name))

  const diff = DIFFICULTY[tutorial.difficulty]

  /*
   * The three figures at the top of the rail. The board's are time / parts
   * cost / steps; this schema has the time but no part prices and no steps
   * (they live in the PDF), so the other two count what the page lists
   * instead of inventing a total a parent would plan an evening around.
   */
  const stats: Array<[string, string | number]> = [
    ...(tutorial.build_minutes != null
      ? ([['time', formatBuildTime(tutorial.build_minutes)]] as Array<[string, string]>)
      : []),
    ['parts', tutorial.parts.length],
    ['tools', tutorial.tools.length],
  ]

  // The board's review line names who checked it and when. The person is named
  // as well as the organisation, as the backing badge this replaced did: a
  // leader looking at published work needs to know who published it. Before
  // review there is nobody to name, so it says what will happen.
  const who = tutorial.reviewer?.name
  const org = tutorial.reviewed_for?.name
  const reviewer = who && org ? `${who} for ${org}` : (who ?? org)
  const when = tutorial.reviewed_at
    ? ` on ${longDate(tutorial.reviewed_at).replace(/^\w+ /, '')}`
    : ''
  const reviewNote = reviewer
    ? `${tutorial.safety_declared_at ? 'Safety checklist affirmed by the author and reviewed' : 'Reviewed'} by ${reviewer}${when}.`
    : 'Read by a reviewer before it goes public.'

  const showFiles = tutorial.kind === 'assistive_tech' && tutorial.stl_files.length > 0

  const partsAndTools = (
    <div className="flex flex-col gap-7">
      {tutorial.parts.length > 0 && (
        <div className="guide-table">
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>Qty</th>
                <th>Where to buy</th>
              </tr>
            </thead>
            <tbody>
              {tutorial.parts.map((p) => (
                <tr key={p.id}>
                  <td className="font-bold">
                    {p.name}
                    {p.is_optional && <span className="pill-tag ml-2 text-muted">Optional</span>}
                  </td>
                  <td className="font-mono text-sm">{p.quantity}</td>
                  <td>
                    <BuyLinks item={p.name} links={p.buy_links} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tutorial.tools.length > 0 && (
        <div className="flex flex-col gap-3.5">
          <div>
            <h3 className="m-0 font-display text-[26px] font-extrabold text-ink">Tools you&apos;ll need</h3>
            <p className="m-0 mt-1 text-sm text-muted">Tools are a one-off, and most are borrowable.</p>
          </div>
          <div className="flex items-center gap-3.5 rounded-[var(--radius-inset)] bg-brand-tint px-[18px] py-4 text-ink">
            <Wrench size={32} weight="duotone" className="flex-none text-brand-dark" aria-hidden="true" />
            <p className="m-0 text-sm leading-[1.55]">
              You may already own most of these. If it&apos;s your first build,{' '}
              <Link href="/learn/tools-and-materials" className="font-extrabold">
                Tools and materials
              </Link>{' '}
              on Learn covers what to buy, what to borrow, and where.
            </p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {tutorial.tools.map((t) => (
              <li key={t.id} className="guide-row">
                <span aria-hidden="true" className="guide-row__tile">
                  <Wrench size={24} weight="duotone" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-extrabold text-ink">
                    {t.name}
                    {t.is_optional && <span className="pill-tag ml-2 text-muted">Optional</span>}
                  </span>
                  <span className="text-xs">
                    <BuyLinks item={t.name} links={t.buy_links} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  const files = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tutorial.stl_files.map((f) => (
          <div key={f.id} className="guide-row guide-row--file">
            <span aria-hidden="true" className="guide-row__tile" style={{ background: 'var(--tviolet)', color: 'var(--tink)' }}>
              <Cube size={28} weight="duotone" />
            </span>
            <p className="m-0 min-w-0 flex-1 truncate font-mono text-sm font-extrabold text-ink">{f.filename}</p>
            <a
              href={fileHref('stl-files', f.file_url)}
              aria-label={`Download ${f.filename}`}
              className="btn btn-primary btn-sm no-underline"
            >
              <DownloadSimple size={16} weight="bold" aria-hidden="true" /> STL
            </a>
          </div>
        ))}
      </div>
      {/* Where a print request starts. "Parts come from the guide, never
          uploaded" is only true if the door is on the guide — putting it on
          the printing section instead would leave somebody there with nothing
          to ask for. */}
      <p className="m-0 flex items-center gap-2.5 rounded-[var(--radius-inset)] bg-brand-tint px-[18px] py-3.5 text-sm leading-[1.5] text-ink">
        <Printer size={24} weight="duotone" className="flex-none" aria-hidden="true" />
        <span className="flex-1">
          <strong>No printer?</strong> Anyone on SPLAT with one can print these for you. You cover
          the filament, nothing else.
        </span>
        <a href={`/printing/requests?guide=${tutorial.id}`} className="whitespace-nowrap font-extrabold text-ink">
          Request a print →
        </a>
      </p>
    </div>
  )

  const safety = (
    <ul className="m-0 flex list-none flex-col gap-3 rounded-[var(--radius-inset)] border border-line bg-surface p-5 shadow-e2">
      {SAFETY_CHECKLIST.map((s) => (
        <li key={s} className="flex items-start gap-3 font-semibold text-ink">
          <CheckCircle size={24} weight="fill" className="flex-none text-success" aria-hidden="true" />
          {s}
        </li>
      ))}
    </ul>
  )

  const tabs = [
    ...(tutorial.parts.length + tutorial.tools.length > 0
      ? [{ key: 'parts', label: 'Parts & tools', content: partsAndTools }]
      : []),
    ...(showFiles ? [{ key: 'files', label: 'Files & print settings', content: files }] : []),
    ...(tutorial.safety_declared_at ? [{ key: 'safety', label: 'Safety', content: safety }] : []),
  ]

  const recs = tutorial.tutorial_recommendations ?? []

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-7">
        <header>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="pill-tag pill-tag--lg" style={{ backgroundColor: diff.tint }}>
              <diff.Icon weight="fill" aria-hidden="true" />
              {diff.label}
            </span>
            <span className="pill-tag pill-tag--lg">{KIND_LABEL[tutorial.kind]}</span>
            {tutorial.maturity !== 'complete' && (
              <span className="pill-tag pill-tag--lg">{MATURITY_LABEL[tutorial.maturity]}</span>
            )}
            {backers.length > 0 && (
              <span className="pill-tag pill-tag--lg" style={{ backgroundColor: 'var(--tok)' }}>
                <SealCheck weight="fill" aria-hidden="true" />
                Backed by {listNames(backers)}
              </span>
            )}
          </div>
          <h1 className="title-article">{tutorial.title}</h1>
          {tutorial.description && (
            <p className="mt-3 max-w-[60ch] text-lg leading-[1.55] text-muted">
              {tutorial.description}
            </p>
          )}
          {(authors.length > 0 || tutorial.updated_at) && (
            <div className="mt-5 flex flex-wrap items-center gap-2.5 text-sm">
              {authors.length > 0 && (
                <span className="inline-flex items-center gap-2 font-bold text-ink">
                  <span aria-hidden="true" className="inline-flex pl-[9px]">
                    {authors.map((name) => (
                      <span key={name} className="byline-avatar">
                        {initials(name)}
                      </span>
                    ))}
                  </span>
                  {listNames(authors)}
                </span>
              )}
              {authors.length > 0 && tutorial.updated_at && <span className="text-muted">·</span>}
              {tutorial.updated_at && (
                <span className="font-semibold text-muted">Updated {agoInWords(tutorial.updated_at)}</span>
              )}
            </div>
          )}
        </header>

        <PhotoCarousel urls={tutorial.photo_urls} alt={tutorial.title} />

        <SectionTabs label="Guide sections" tabs={tabs} />

        {/* Where the creator points next. The public route has already dropped
            anything a parent could not open, so on the public page every card
            here leads somewhere; the review pages get the unfiltered list and
            tag the ones that are still hidden, because a reviewer should know
            the recommendation exists even though a parent cannot follow it. */}
        {recs.length > 0 && (
          <section aria-labelledby="tut-rec-h" className="flex flex-col gap-4 border-t border-line pt-[26px]">
            <div>
              <h2 id="tut-rec-h" className="m-0 font-display text-[26px] font-extrabold text-ink">
                Also worth a look
              </h2>
              <p className="m-0 mt-1.5 max-w-[58ch] text-[15px] leading-[1.5] text-muted">
                Up to three things the author points you at next.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {recs.map(({ tutorials: r }) => {
                const Glyph = r.kind === 'assistive_tech' ? Cube : HandTap
                return (
                  <div key={r.id} className="flex flex-col gap-2">
                    <BoundaryLink href={`/tutorials/${r.id}`} data-testid="rec-card" className="rec-card">
                      <span aria-hidden="true" className="rec-card__band" style={{ background: tintFor(r.id) }}>
                        <Glyph size={46} weight="duotone" />
                      </span>
                      <span className="rec-card__body">
                        <span className="eyebrow text-muted">{KIND_LABEL[r.kind]} guide</span>
                        <span className="text-[17px] font-extrabold leading-[1.3] text-ink">{r.title}</span>
                        <span className="mt-auto pt-2 text-[13px] font-extrabold text-brand-deep">
                          {DIFFICULTY[r.difficulty].label}
                        </span>
                      </span>
                    </BoundaryLink>
                    {r.status !== 'approved' && (
                      <span className="badge self-start bg-honey-soft text-ink">
                        Not yet approved — hidden from the public page
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <NotMedicalNote />
          </section>
        )}
      </div>

      {/*
        * The rail. The board puts the decision here and the evidence on the
        * left: how much it takes, the one filled action, and — because this is
        * the page somebody opens when they are stuck — a way to ask a person.
        */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-[22px] shadow-[var(--shadow-e3),var(--shadow-hi)]">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
            {stats.map(([label, n]) => (
              <div key={label} className="rounded-[var(--radius-field)] bg-sunken p-2.5 text-center">
                <p className="m-0 font-display text-xl font-extrabold tabular-nums text-ink">{n}</p>
                <p className="m-0 text-xs font-bold text-muted">{label}</p>
              </div>
            ))}
          </div>

          {tutorial.tutorial_pdf_url && (
            <a
              href={fileHref('tutorial-pdfs', tutorial.tutorial_pdf_url)}
              {...newTab}
              className="btn btn-primary btn-block no-underline"
            >
              <FileText />
              {signedIn ? 'Download guide (PDF)' : 'Sign in to download'}
            </a>
          )}

          {actions && <div className="rail-actions">{actions}</div>}

          {!signedIn && (
            <p className="m-0 text-[13px] leading-[1.5] text-muted">
              The PDF and your saved list come with an account. Both are free.
            </p>
          )}

          <p className="m-0 flex gap-2 text-[13px] leading-[1.5] text-muted">
            <ShieldCheck size={18} weight="fill" className="flex-none text-success" aria-hidden="true" />
            {reviewNote}
          </p>
        </div>

        {/* The board's mint help card. This page is where somebody discovers
            they are missing a tool, and the honest answer is a person rather
            than another paragraph. */}
        <div className="flex flex-col gap-3 rounded-card border border-line bg-mint-soft p-[22px] text-ink">
          <div className="flex items-start gap-3">
            <HandHeart size={30} weight="duotone" className="flex-none" aria-hidden="true" />
            <div>
              <p className="m-0 font-display text-lg font-extrabold leading-[1.2]">
                Need help with this build?
              </p>
              <p className="m-0 mt-1 text-sm leading-[1.5]">
                Missing parts or tools, want someone beside you, or want it built for you. Two
                questions, one helper — you only ever cover the parts.
              </p>
            </div>
          </div>
          <Link
            href={`/get-involved/requests/new?guide=${tutorial.id}`}
            className="btn btn-block no-underline"
            style={{ background: 'var(--color-ink)', color: 'var(--color-surface)' }}
          >
            <Lifebuoy size={18} weight="bold" aria-hidden="true" />
            Get help with this build
          </Link>
          <p className="m-0 text-[13px] leading-[1.5]">
            Or skip the build — somebody nearby may have already made one.{' '}
            <Link href="/toy-library" className="font-extrabold text-ink underline">
              Toy library →
            </Link>
          </p>
        </div>
      </aside>
    </div>
  )
}

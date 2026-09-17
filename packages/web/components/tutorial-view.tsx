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
 * `headerAction` is the only slot: the public page puts its SaveButton in the
 * title row, and a reviewer has nothing to save.
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
import { Badge } from '@/components/badge'
import { TutorialCard } from '@/components/tutorial-card'
import { OrgBadges } from '@/components/org-badges'
import { FileText, Download } from '@/components/icons'
import Link from 'next/link'
import { HandHeart, Lifebuoy, ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import { KIND_LABEL, MATURITY_LABEL, type TutorialWithDetails, type TutorialOrg } from '@splat-connect/types'

type Viewable = TutorialWithDetails & {
  tutorial_orgs?: TutorialOrg[]
  reviewer?: { name: string } | null
  reviewed_for?: { name: string } | null
}

export function TutorialView({
  tutorial,
  backing,
  headerAction,
  signedIn,
}: {
  tutorial: Viewable
  /** The leader page fetches backing separately; everyone else has it embedded. */
  backing?: TutorialOrg[]
  headerAction?: ReactNode
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

  /*
   * The three figures at the top of the rail. The board's are time / parts /
   * steps; there is no time estimate on a tutorial in this schema, so the
   * third slot counts the printable files instead of inventing a duration.
   * A guessed "about 40 minutes" on a page a parent plans an evening around
   * is worse than one fewer number.
   */
  const stats: Array<[string, number]> = [
    ['parts', tutorial.parts.length],
    ['tools', tutorial.tools.length],
    ...(tutorial.kind === 'assistive_tech'
      ? ([['files', tutorial.stl_files.length]] as Array<[string, number]>)
      : []),
  ]

  return (
    <div className="flex flex-col gap-7">
      {/* Full width above the split, as the board has it: the chips, the title
          and who wrote it belong to the whole page, not to one of its columns.
          They used to sit inside the left rail at .title-detail, which made the
          name of the thing you opened smaller than the section headings under
          it. */}
      <header>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge status={tutorial.difficulty} />
          <Badge status={tutorial.kind} label={KIND_LABEL[tutorial.kind]} />
          {tutorial.maturity !== 'complete' && (
            <Badge status={tutorial.maturity} label={MATURITY_LABEL[tutorial.maturity]} />
          )}
          <OrgBadges
            backing={backing ?? tutorial.tutorial_orgs ?? []}
            approvedByName={tutorial.reviewer?.name}
            approvedForOrgName={tutorial.reviewed_for?.name}
          />
          {headerAction}
        </div>
        <h1 className="title-article">{tutorial.title}</h1>
        {tutorial.description && (
          <p className="mt-3 max-w-[60ch] text-lg leading-[1.55] text-muted">
            {tutorial.description}
          </p>
        )}
        {authors.length > 0 && (
          <p className="mt-5 text-sm font-bold text-ink">
            By {authors.join(', ')}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Reference column: the photos, then Parts, Tools, Files — the
          build-time reference list. Plain divided rows (.ref-row) instead of
          one .card per item, so the list doesn't compete visually with the
          rail's single action card. */}
      <div className="flex min-w-0 flex-col gap-6">
        <PhotoCarousel urls={tutorial.photo_urls} alt={tutorial.title} className="aspect-[4/3]" />
        {tutorial.parts.length > 0 && (
          <div className="ref-section ref-section--parts">
            <h2 className="mb-1">Parts needed</h2>
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
          <div className="ref-section ref-section--tools">
            <h2 className="mb-1">Tools needed</h2>
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
        {/* Gated on kind as well as on rows: a toy adaptation has no STL step,
            and one switched from assistive tech keeps its old rows without
            showing them. */}
        {tutorial.kind === 'assistive_tech' && tutorial.stl_files.length > 0 && (
          <div className="ref-section ref-section--files">
            <h2 className="mb-1">Files for 3D printing</h2>
            {tutorial.stl_files.map((f) => (
              <a
                key={f.id}
                href={fileHref('stl-files', f.file_url)}
                className="ref-row flex items-center gap-2 text-sm font-semibold text-brand-dark hover:underline"
              >
                <Download /> {f.filename}
              </a>
            ))}
            {/* Where a print request starts. "Parts come from the guide, never
                uploaded" is only true if the door is on the guide — putting it
                on the printing section instead would leave somebody there with
                nothing to ask for. */}
            <a
              href={`/printing/requests?guide=${tutorial.id}`}
              className="btn btn-quiet mt-3 no-underline"
            >
              Ask a printer for these parts
            </a>
          </div>
        )}
        {/* Where the creator points next. The public route has already dropped
            anything a parent could not open, so on the public page every card
            here leads somewhere; the review pages get the unfiltered list and
            tag the ones that are still hidden, because a reviewer should know
            the recommendation exists even though a parent cannot follow it. */}
        {(tutorial.tutorial_recommendations ?? []).length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-bold">Also worth a look</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tutorial.tutorial_recommendations.map((r) => (
                <div key={r.tutorials.id} className="flex flex-col gap-2">
                  <TutorialCard tutorial={r.tutorials} />
                  {r.tutorials.status !== 'approved' && (
                    <span className="badge self-start bg-honey-soft text-ink">
                      Not yet approved — hidden from the public page
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3"><NotMedicalNote /></div>
          </div>
        )}
      </div>

      {/*
        * The rail. The board puts the decision here and the evidence on the
        * left: how much it takes, the one filled action, and — because this is
        * the page somebody opens when they are stuck — a way to ask a person.
        */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-[22px] shadow-[var(--shadow-e3),var(--shadow-hi)]">
          {stats.length > 0 && (
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
              {stats.map(([label, n]) => (
                <div
                  key={label}
                  className="rounded-[var(--radius-field)] bg-sunken p-2.5 text-center"
                >
                  <p className="m-0 font-display text-xl font-extrabold tabular-nums text-ink">{n}</p>
                  <p className="m-0 text-xs font-bold text-muted">{label}</p>
                </div>
              ))}
            </div>
          )}

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

          <p className="m-0 flex gap-2 text-[13px] leading-[1.5] text-muted">
            <ShieldCheck size={18} weight="fill" className="flex-none text-success" aria-hidden="true" />
            {(backing ?? tutorial.tutorial_orgs ?? []).some((b) => b.status === 'accepted')
              ? 'A therapy service read this guide before it went public.'
              : 'Read by a SPLAT reviewer before it went public.'}
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
                Missing parts or tools, want someone beside you, or want it built for you. One
                request, one helper — you only ever cover the parts.
              </p>
            </div>
          </div>
          <Link
            href="/get-involved/makers-wanted"
            className="btn btn-block no-underline"
            style={{ background: 'var(--color-ink)', color: 'var(--color-surface)' }}
          >
            <Lifebuoy size={18} weight="bold" aria-hidden="true" />
            Ask for a build
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
    </div>
  )
}

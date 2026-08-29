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
 */
import type { ReactNode } from 'react'
import Image from 'next/image'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { OrgBadges } from '@/components/org-badges'
import { FileText, Download } from '@/components/icons'
import type { TutorialWithDetails, TutorialOrg } from '@splat-connect/types'

type Viewable = TutorialWithDetails & {
  tutorial_orgs?: TutorialOrg[]
  reviewer?: { name: string } | null
  reviewed_for?: { name: string } | null
}

export function TutorialView({
  tutorial,
  backing,
  headerAction,
}: {
  tutorial: Viewable
  /** The leader page fetches backing separately; everyone else has it embedded. */
  backing?: TutorialOrg[]
  headerAction?: ReactNode
}) {
  const contributors = tutorial.tutorial_contributors ?? []
  const primaryContributor = contributors.find((c) => c.role === 'primary')
  const collaborators = contributors.filter((c) => c.role === 'collaborator')

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {/* Sticky rail: the "can I do this" verdict, pinned while the reference
          column scrolls. md:self-start shrinks the rail's box to its content height,
          giving it room to move within the grid area before sticky release at the
          containing block (the row) boundary. */}
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
          backing={backing ?? tutorial.tutorial_orgs ?? []}
          approvedByName={tutorial.reviewer?.name}
          approvedForOrgName={tutorial.reviewed_for?.name}
        />
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="title-detail">{tutorial.title}</h1>
            <DifficultyBadge difficulty={tutorial.difficulty} />
            {headerAction}
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
          <div className="card-flat ref-section ref-section--parts">
            <h2 className="mb-1 text-sm font-bold">Parts needed</h2>
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
          <div className="card-flat ref-section ref-section--tools">
            <h2 className="mb-1 text-sm font-bold">Tools needed</h2>
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
          <div className="card-flat ref-section ref-section--files">
            <h2 className="mb-1 text-sm font-bold">Files for 3D printing</h2>
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

/**
 * Public tutorial detail.
 *
 * Ordered the way a parent works: Decide, Gather, Build. The page previously led
 * with a photo column and pushed the PDF — the thing they actually came for —
 * below the description and contributor line, and buried whether the build needs
 * a 3D printer in the last section. Both now sit in the first screenful.
 *
 * The requirements strip is derived entirely from the payload this page already
 * fetches (parts, tools, stl_files), so nothing here costs an extra call.
 *
 * Two accessible names are load-bearing and must not drift:
 * - "Download Tutorial PDF" is matched by name AND read for its boundingBox in
 *   tests/e2e/responsive/reflow.spec.ts, which asserts it sits above the "Parts
 *   needed" heading at phone width. A second link with the same name would make
 *   that a strict-mode violation, so the restated CTA in Build is "Download PDF".
 * - "Parts needed", "Tools needed" and "Files for 3D printing" are matched
 *   exactly by tests/e2e/public/tutorial-detail.spec.ts.
 *
 * Related files:
 * - components/reveal.tsx: the section reveals below the fold
 * - components/org-badges.tsx: the backing verdict
 */
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { OrgBadges } from '@/components/org-badges'
import { Reveal } from '@/components/reveal'
import { fadeIn } from '@/lib/motion'
import { FileText, Download, Toy, Printer, Box, Clipboard } from '@/components/icons'
import type { TutorialWithDetails, TutorialOrg, BuyLink } from '@splat-connect/types'

/** A buy link sized to be tapped, not squinted at. */
function BuyLinks({ links, itemName }: { links: BuyLink[]; itemName: string }) {
  if (links.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((bl, i) => (
        <a
          key={i}
          href={bl.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Buy ${itemName} from ${bl.label}`}
          className="inline-flex min-h-11 items-center rounded-field bg-surface px-3 text-xs font-bold text-brand-dark transition-colors hover:bg-brand-tint"
        >
          {bl.label || 'Buy →'}
        </a>
      ))}
    </div>
  )
}

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
  const credits = [primaryContributor, ...collaborators]
    .filter(Boolean)
    .map((c) => c!.profiles?.name)
    .filter((name): name is string => Boolean(name))

  // Optional items sort last within their own list: the required set is the
  // shopping list, and interleaving the two makes it unusable as one.
  const byRequiredFirst = <T extends { is_optional?: boolean }>(items: T[]) =>
    [...items].sort((a, b) => Number(a.is_optional) - Number(b.is_optional))

  const parts = byRequiredFirst(tutorial.parts)
  const tools = byRequiredFirst(tutorial.tools)
  const needsPrinting = tutorial.stl_files.length > 0

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  return (
    <div className="flex flex-col gap-12">
      {/* --- Decide ------------------------------------------------------- */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
        {tutorial.toy_photo_url ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-sunken">
            <Image
              src={tutorial.toy_photo_url}
              alt={tutorial.title}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-brand-tint text-7xl text-brand-dark">
            <Toy data-testid="toy-placeholder" />
          </div>
        )}

        <div>
          <OrgBadges
            backing={tutorial.tutorial_orgs ?? []}
            approvedByName={tutorial.reviewer?.name}
            approvedForOrgName={tutorial.reviewed_for?.name}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">{tutorial.title}</h1>
            <DifficultyBadge difficulty={tutorial.difficulty} />
          </div>
          {tutorial.description && (
            <p className="mt-3 max-w-prose leading-relaxed text-muted">
              {tutorial.description}
            </p>
          )}

          {/* What this build asks of you, before scrolling. Whether a printer is
              needed used to be discoverable only from the last section. */}
          <ul className="mt-5 flex flex-wrap gap-2">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 text-xs font-bold text-brand-deep">
              <Box aria-hidden="true" /> {plural(tutorial.parts.length, 'part')}
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-honey-soft px-3 py-1.5 text-xs font-bold text-honey-deep">
              <Clipboard aria-hidden="true" /> {plural(tutorial.tools.length, 'tool')}
            </li>
            <li
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                needsPrinting
                  ? 'bg-mint-soft text-mint-deep'
                  : 'bg-sunken text-muted'
              }`}
            >
              <Printer aria-hidden="true" />
              {needsPrinting ? '3D printing needed' : 'No printing needed'}
            </li>
          </ul>

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
      </section>

      {/* --- Gather ------------------------------------------------------- */}
      {/* Reveal wraps the section, not each row: .ref-row:last-child drops its
          divider, and a per-row wrapper would make every row a last-child. */}
      <Reveal variants={fadeIn}>
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          {parts.length > 0 && (
            <div className="card-flat ref-section ref-section--parts">
              <h2 className="mb-1 text-sm font-bold">Parts needed</h2>
              {parts.map((p) => (
                <div key={p.id} className={`ref-row text-sm ${p.is_optional ? 'opacity-70' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink">
                      <strong>{p.name}</strong> × {p.quantity}
                    </span>
                    {p.is_optional && (
                      <span className="badge shrink-0 bg-surface text-brand-deep">
                        Optional
                      </span>
                    )}
                  </div>
                  <BuyLinks links={p.buy_links} itemName={p.name} />
                </div>
              ))}
            </div>
          )}

          {tools.length > 0 && (
            <div className="card-flat ref-section ref-section--tools">
              <h2 className="mb-1 text-sm font-bold">Tools needed</h2>
              {tools.map((t) => (
                <div key={t.id} className={`ref-row text-sm ${t.is_optional ? 'opacity-70' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink">
                      <strong>{t.name}</strong>
                    </span>
                    {t.is_optional && (
                      <span className="badge shrink-0 bg-surface text-honey-deep">
                        Optional
                      </span>
                    )}
                  </div>
                  <BuyLinks links={t.buy_links} itemName={t.name} />
                </div>
              ))}
            </div>
          )}
        </section>
      </Reveal>

      {/* --- Build -------------------------------------------------------- */}
      <Reveal variants={fadeIn}>
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            {needsPrinting && (
              <div className="card-flat ref-section ref-section--files">
                <h2 className="mb-1 text-sm font-bold">Files for 3D printing</h2>
                {tutorial.stl_files.map((f) => (
                  <a
                    key={f.id}
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ref-row flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-dark hover:underline"
                  >
                    <Download /> {f.filename}
                  </a>
                ))}
              </div>
            )}

            {credits.length > 0 && (
              <div className="card p-5">
                <h2 className="text-sm font-bold text-ink">
                  {credits.length === 1 ? 'Contributor' : 'Contributors'}
                </h2>
                {/* One element, not "By" beside a separate name node: the e2e
                    spec matches /By\s+<name>/ across the whole string. */}
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  By {credits.join(', ')}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Written and shared for free so another family does not have to
                  work it out from scratch.
                </p>
              </div>
            )}
          </div>

          {tutorial.tutorial_pdf_url && (
            <div className="card card-tint p-5">
              <h2 className="text-sm font-bold text-brand-deep">Ready to build?</h2>
              <p className="mt-1 text-sm leading-relaxed text-brand-deep">
                The step-by-step instructions, with photos, are in the guide.
              </p>
              {/* Deliberately not "Download Tutorial PDF" — see the file header. */}
              <a
                href={tutorial.tutorial_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-accent btn-block mt-4"
              >
                <FileText /> Download PDF
              </a>
            </div>
          )}
        </section>
      </Reveal>
    </div>
  )
}

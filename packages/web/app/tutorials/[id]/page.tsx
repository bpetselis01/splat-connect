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
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column: photo + meta */}
        <div>
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
          <div className="mt-6 flex flex-col gap-3">
            {tutorial.tutorial_pdf_url && (
              <a
                href={tutorial.tutorial_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-block"
              >
                <FileText /> Download Tutorial PDF
              </a>
            )}
            {tutorial.stl_files.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-bold text-ink">
                  Files for 3D printing
                </h2>
                <div className="flex flex-col gap-2">
                  {tutorial.stl_files.map((f) => (
                    <a
                      key={f.id}
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-soft btn-block btn-sm"
                    >
                      <Download /> {f.filename}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: parts + tools */}
        <div className="flex flex-col gap-6">
          {tutorial.parts.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-bold text-ink">🔩 Parts needed</h2>
              <div className="flex flex-col gap-2">
                {tutorial.parts.map((p) => (
                  <div key={p.id} className="card px-4 py-3 text-sm">
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
            </div>
          )}
          {tutorial.tools.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-bold text-ink">🔧 Tools needed</h2>
              <div className="flex flex-col gap-2">
                {tutorial.tools.map((t) => (
                  <div key={t.id} className="card px-4 py-3 text-sm">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

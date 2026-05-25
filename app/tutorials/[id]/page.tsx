import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { TutorialWithDetails } from '@/lib/types'

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('tutorials')
    .select(`
      *,
      parts (*),
      tools (*),
      stl_files (*),
      tutorial_contributors (*, profiles (*))
    `)
    .eq('id', id)
    .eq('status', 'approved')
    .single()

  if (!data) notFound()

  const tutorial = data as TutorialWithDetails

  const contributors = tutorial.tutorial_contributors ?? []
  const primaryContributor = contributors.find((c) => c.role === 'primary')
  const collaborators = contributors.filter((c) => c.role === 'collaborator')

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column: photo + meta */}
        <div>
          {tutorial.toy_photo_url ? (
            <div className="relative h-56 w-full rounded-xl overflow-hidden">
              <Image
                src={tutorial.toy_photo_url}
                alt={tutorial.title}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="h-56 bg-blue-100 rounded-xl flex items-center justify-center text-6xl">
              🧸
            </div>
          )}
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{tutorial.title}</h1>
              <DifficultyBadge difficulty={tutorial.difficulty} />
            </div>
            {tutorial.description && (
              <p className="text-gray-600 text-sm leading-relaxed">
                {tutorial.description}
              </p>
            )}
            {contributors.length > 0 && (
              <p className="text-xs text-gray-400 mt-3">
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
                className="block bg-[#1e3a5f] text-white text-center py-2.5 rounded-lg text-sm font-semibold hover:bg-[#16304f]"
              >
                📄 Download Tutorial PDF
              </a>
            )}
            {tutorial.stl_files.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  🖨️ STL FILES FOR 3D PRINTING
                </p>
                <div className="flex flex-col gap-2">
                  {tutorial.stl_files.map((f) => (
                    <a
                      key={f.id}
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-teal-600 text-white text-center py-2 rounded-lg text-xs font-semibold hover:bg-teal-700"
                    >
                      ↓ {f.filename}
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
              <h2 className="font-bold text-sm mb-3">🔩 Parts needed</h2>
              <div className="flex flex-col gap-2">
                {tutorial.parts.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white border rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        <strong>{p.name}</strong> × {p.quantity}
                      </span>
                      {p.is_optional && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                          Optional
                        </span>
                      )}
                    </div>
                    {p.buy_links.length > 0 && (
                      <div className="flex gap-3 flex-wrap mt-1">
                        {p.buy_links.map((bl, i) => (
                          <a
                            key={i}
                            href={bl.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Buy ${p.name} from ${bl.label}`}
                            className="text-blue-600 text-xs hover:underline"
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
              <h2 className="font-bold text-sm mb-3">🔧 Tools needed</h2>
              <div className="flex flex-col gap-2">
                {tutorial.tools.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white border rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        <strong>{t.name}</strong>
                      </span>
                      {t.is_optional && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                          Optional
                        </span>
                      )}
                    </div>
                    {t.buy_links.length > 0 && (
                      <div className="flex gap-3 flex-wrap mt-1">
                        {t.buy_links.map((bl, i) => (
                          <a
                            key={i}
                            href={bl.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Buy ${t.name} from ${bl.label}`}
                            className="text-blue-600 text-xs hover:underline"
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

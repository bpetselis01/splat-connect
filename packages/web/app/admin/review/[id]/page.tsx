import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { TutorialWithDetails, Difficulty } from '@splat-connect/types'

async function approveTutorial(id: string) {
  'use server'
  const supabase = await createClient()
  await supabase
    .from('tutorials')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath(`/admin/review/${id}`)
  revalidatePath('/library')
}

async function rejectTutorial(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const note = formData.get('note') as string
  const supabase = await createClient()
  await supabase
    .from('tutorials')
    .update({
      status: 'rejected',
      rejection_note: note || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath(`/admin/review/${id}`)
}

export default async function ReviewTutorialPage({
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
    .eq('status', 'pending')
    .single()

  if (!data) notFound()

  const tutorial = data as TutorialWithDetails
  const contributor = tutorial.tutorial_contributors?.[0]?.profiles

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{tutorial.title}</h1>
        <DifficultyBadge difficulty={tutorial.difficulty as Difficulty} />
      </div>
      {contributor && (
        <p className="text-sm text-gray-500 mb-6">
          Submitted by <strong>{contributor.name}</strong> ({contributor.email})
        </p>
      )}

      {tutorial.toy_photo_url && (
        <div className="relative h-48 w-full rounded-xl overflow-hidden mb-6">
          <Image src={tutorial.toy_photo_url} alt={tutorial.title} fill className="object-cover" />
        </div>
      )}

      {tutorial.tutorial_pdf_url && (
        <a
          href={tutorial.tutorial_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold mb-6 hover:bg-[#16304f]"
        >
          📄 Open Tutorial PDF
        </a>
      )}

      {tutorial.parts.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-sm mb-2">Parts ({tutorial.parts.length})</h2>
          <div className="flex flex-col gap-1">
            {tutorial.parts.map((p) => (
              <div key={p.id} className="text-sm bg-white border rounded px-3 py-1.5 flex justify-between">
                <span>{p.name} × {p.quantity}</span>
                {p.buy_links.length > 0 && (
                  <div className="flex gap-2">
                    {p.buy_links.map((bl, i) => (
                      <a key={i} href={bl.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs">
                        {bl.label || 'Link →'}
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
        <div className="mb-6">
          <h2 className="font-bold text-sm mb-2">Tools ({tutorial.tools.length})</h2>
          <div className="flex flex-col gap-1">
            {tutorial.tools.map((t) => (
              <div key={t.id} className="text-sm bg-white border rounded px-3 py-1.5 flex justify-between">
                <span>{t.name}</span>
                {t.buy_links.length > 0 && (
                  <div className="flex gap-2">
                    {t.buy_links.map((bl, i) => (
                      <a key={i} href={bl.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs">
                        {bl.label || 'Link →'}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tutorial.stl_files.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-sm mb-2">STL Files ({tutorial.stl_files.length})</h2>
          <div className="flex flex-col gap-1">
            {tutorial.stl_files.map((f) => (
              <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                ↓ {f.filename}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="border-t pt-6 flex flex-col gap-4">
        <form action={approveTutorial.bind(null, tutorial.id)}>
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
          >
            ✓ Approve — publish to library
          </button>
        </form>
        <form action={rejectTutorial} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={tutorial.id} />
          <textarea
            name="note"
            rows={2}
            placeholder="Optional feedback for the contributor (shown on their My Tutorials page)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-full bg-red-100 text-red-700 py-2.5 rounded-lg font-semibold hover:bg-red-200"
          >
            ✕ Reject
          </button>
        </form>
      </div>
    </div>
  )
}

import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Image from 'next/image'
import { apiClient } from '@/lib/api-client'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { adminActions } from '@/components/project-actions'
import type { TutorialWithDetails, Difficulty } from '@splat-connect/types'

type Reviewed = TutorialWithDetails & {
  reviewer?: { name: string } | null
  reviewed_for?: { name: string } | null
}

async function approveTutorial(id: string) {
  'use server'
  await apiClient.patch(`/api/admin/tutorials/${id}/status`, { status: 'approved' })
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath(`/admin/review/${id}`)
  revalidatePath('/library')
}

async function rejectTutorial(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const note = formData.get('note') as string
  await apiClient.patch(`/api/admin/tutorials/${id}/status`, {
    status: 'rejected',
    rejection_note: note || null,
  })
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath(`/admin/review/${id}`)
}

/**
 * Take down published work.
 *
 * Lands in `rejected`, the same state as a normal rejection, so the contributor
 * sees the note where they already look and can edit and resubmit. The LABEL is
 * what carries the difference: this tutorial was live and a parent may have been
 * following it.
 *
 * The note is required and checked here as well as on the form, because `required`
 * is only the browser's opinion. It is the only thing the contributor will ever see
 * explaining why work that was live is not any more.
 */
async function unpublishTutorial(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const note = ((formData.get('note') as string) ?? '').trim()
  if (!note) return
  await apiClient.patch(`/api/admin/tutorials/${id}/status`, {
    status: 'rejected',
    rejection_note: note,
  })
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath('/admin/spot-check')
  revalidatePath('/library')
  revalidatePath(`/tutorials/${id}`)
  redirect('/admin/spot-check')
}

export default async function ReviewTutorialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let tutorial: Reviewed
  try {
    tutorial = await apiClient.get<Reviewed>(`/api/tutorials/${id}`)
  } catch {
    notFound()
  }

  // No status refusal. This page used to 404 anything not pending, which meant an
  // admin who found a bad approval in spot-check had nowhere to act — the reactive
  // control decision 14 promised, unreachable.
  const actions = adminActions(tutorial!.status)

  const contributor = tutorial!.tutorial_contributors?.[0]?.profiles

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-ink">{tutorial!.title}</h1>
        <DifficultyBadge difficulty={tutorial!.difficulty as Difficulty} />
      </div>
      {contributor && (
        <p className="mb-6 text-sm text-muted">
          Submitted by <strong className="text-ink">{contributor.name}</strong> ({contributor.email})
        </p>
      )}

      {tutorial!.toy_photo_url && (
        <div className="relative mb-6 h-48 w-full overflow-hidden rounded-2xl bg-sunken">
          <Image src={tutorial!.toy_photo_url} alt={tutorial!.title} fill className="object-cover" />
        </div>
      )}

      {tutorial!.tutorial_pdf_url && (
        <a
          href={tutorial!.tutorial_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary mb-6"
        >
          📄 Open Tutorial PDF
        </a>
      )}

      {tutorial!.parts.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-ink">Parts ({tutorial!.parts.length})</h2>
          <div className="flex flex-col gap-2">
            {tutorial!.parts.map((p) => (
              <div key={p.id} className="card-flat flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
                <span>{p.name} × {p.quantity}</span>
                {p.buy_links.length > 0 && (
                  <div className="flex gap-3">
                    {p.buy_links.map((bl, i) => (
                      <a key={i} href={bl.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-dark hover:underline">
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

      {tutorial!.tools.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-ink">Tools ({tutorial!.tools.length})</h2>
          <div className="flex flex-col gap-2">
            {tutorial!.tools.map((t) => (
              <div key={t.id} className="card-flat flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
                <span>{t.name}</span>
                {t.buy_links.length > 0 && (
                  <div className="flex gap-3">
                    {t.buy_links.map((bl, i) => (
                      <a key={i} href={bl.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-dark hover:underline">
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

      {tutorial!.stl_files.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-ink">STL Files ({tutorial!.stl_files.length})</h2>
          <div className="flex flex-col items-start gap-1">
            {tutorial!.stl_files.map((f) => (
              <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-dark hover:underline">
                ↓ {f.filename}
              </a>
            ))}
          </div>
        </div>
      )}

      {tutorial!.reviewer && (
        <p className="mb-4 text-sm text-muted">
          Approved by <strong className="text-ink">{tutorial!.reviewer.name}</strong>
          {tutorial!.reviewed_for ? `, ${tutorial!.reviewed_for.name}` : ''}.
        </p>
      )}

      <div className="flex flex-col gap-4 border-t border-line pt-6">
        {actions.includes('approve') && (
          <form action={approveTutorial.bind(null, tutorial!.id)}>
            <button
              type="submit"
              className="btn btn-block bg-mint-deep text-white shadow-rest hover:brightness-90"
            >
              ✓ Approve — publish to library
            </button>
          </form>
        )}

        {actions.includes('reject') && (
          <form action={rejectTutorial} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={tutorial!.id} />
            <label htmlFor="rejection-note" className="sr-only">
              Feedback for the contributor
            </label>
            <textarea
              id="rejection-note"
              name="note"
              rows={2}
              placeholder="Optional feedback for the contributor (shown on their My Tutorials page)"
              className="field"
            />
            <button type="submit" className="btn btn-danger btn-block">
              ✕ Reject
            </button>
          </form>
        )}

        {actions.includes('unpublish') && (
          <form action={unpublishTutorial} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={tutorial!.id} />
            <h2 className="text-lg font-bold text-ink">Unpublish this tutorial</h2>
            <p className="max-w-prose text-sm leading-relaxed text-muted">
              It is live in the library now and a parent may be following it.
              Unpublishing removes it and shows this note to the contributor, who can
              edit and resubmit.
            </p>
            <label htmlFor="unpublish-note" className="mt-1 font-medium text-ink">
              Why are you taking it down?
            </label>
            <textarea id="unpublish-note" name="note" rows={4} required className="field" />
            <button type="submit" className="btn btn-danger btn-block mt-1">
              Unpublish
            </button>
          </form>
        )}

        {actions.length === 0 && (
          <p className="alert max-w-prose">
            {tutorial!.status === 'rejected'
              ? `Rejected${tutorial!.rejection_note ? `: ${tutorial!.rejection_note}` : '.'} The contributor can edit and resubmit.`
              : 'Nothing to do here.'}
          </p>
        )}
      </div>
    </div>
  )
}

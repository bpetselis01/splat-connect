import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { apiClient } from '@/lib/api-client'
import { TutorialView } from '@/components/tutorial-view'
import { adminActions } from '@/components/project-actions'
import { Check, X } from '@/components/icons'
import type { TutorialWithDetails } from '@splat-connect/types'

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
    <div className="max-w-5xl">
      {/* The one thing an admin needs that a parent does not: who to write to.
          Everything else comes from the public view, so the page an admin
          judges is the page that gets published. The approver line that used to
          sit at the bottom is inside that view now, said once. */}
      {contributor && (
        <p className="mb-4 text-sm text-muted">
          Submitted by <strong className="text-ink">{contributor.name}</strong> ({contributor.email})
        </p>
      )}

      <TutorialView tutorial={tutorial!} signedIn />

      <div className="mt-10 flex max-w-2xl flex-col gap-4 border-t border-line pt-6">
        {actions.includes('approve') && (
          <form action={approveTutorial.bind(null, tutorial!.id)}>
            <button
              type="submit"
              className="btn btn-block bg-mint-deep text-white shadow-rest hover:brightness-90"
            >
              <Check /> Approve — publish to library
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
              <X /> Reject
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

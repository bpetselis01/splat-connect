/**
 * Organisation Leader Review Screen
 *
 * The same shape as app/admin/review/[id]/page.tsx, with three differences:
 * the endpoint is POST /api/tutorials/:id/review rather than the admin status
 * endpoint, the rejection note is required, and the body carries org_id so the
 * approval is credited to the right organisation.
 *
 * Related files:
 * - packages/api/src/routes/tutorial-orgs.ts: the review endpoint
 * - app/admin/review/[id]/page.tsx: the admin equivalent this follows
 */
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Image from 'next/image'
import { apiClient } from '@/lib/api-client'
import { isOrgLeader } from '@/lib/org-access'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { TutorialWithDetails, Organization } from '@splat-connect/types'

async function approve(formData: FormData) {
  'use server'
  const tutorialId = formData.get('tutorialId') as string
  const orgId = formData.get('orgId') as string
  // org_id is always sent, even when only one of the leader's organisations backs
  // this project: the API requires it when several do, and the URL already knows
  // which queue this is. The database refuses an org the caller does not lead.
  await apiClient.post(`/api/tutorials/${tutorialId}/review`, {
    status: 'approved',
    org_id: orgId,
  })
  revalidatePath(`/organizations/${orgId}`)
  revalidatePath('/library')
  revalidatePath(`/tutorials/${tutorialId}`)
  redirect(`/organizations/${orgId}`)
}

async function reject(formData: FormData) {
  'use server'
  const tutorialId = formData.get('tutorialId') as string
  const orgId = formData.get('orgId') as string
  const note = ((formData.get('note') as string) ?? '').trim()
  // Mirrors the API, which 400s on an empty note. A rejection with no reason gives
  // the contributor nothing to act on, which is the whole point of the field.
  if (!note) return
  await apiClient.post(`/api/tutorials/${tutorialId}/review`, {
    status: 'rejected',
    org_id: orgId,
    rejection_note: note,
  })
  revalidatePath(`/organizations/${orgId}`)
  redirect(`/organizations/${orgId}`)
}

export default async function OrgReviewPage({
  params,
}: {
  params: Promise<{ id: string; tutorialId: string }>
}) {
  const { id: orgId, tutorialId } = await params
  // A non-leader gets a 404 rather than a redirect: this URL is a workspace, not a
  // public face, and there is nothing here to show them.
  if (!(await isOrgLeader(orgId))) notFound()
  const org = await apiClient.get<Organization>(`/api/organizations/${orgId}`)

  let tutorial: TutorialWithDetails
  try {
    tutorial = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${tutorialId}`)
  } catch {
    notFound()
  }
  if (tutorial!.status !== 'pending') notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-2 text-sm text-muted">Reviewing for {org.name}</p>
      <h1 className="mb-2 text-2xl font-bold text-ink">{tutorial!.title}</h1>
      <DifficultyBadge difficulty={tutorial!.difficulty} />
      {tutorial!.description && <p className="mt-4">{tutorial!.description}</p>}

      {tutorial!.toy_photo_url && (
        <Image
          src={tutorial!.toy_photo_url}
          alt={tutorial!.title}
          width={640}
          height={480}
          className="mt-4 rounded"
        />
      )}

      {tutorial!.tutorial_pdf_url && (
        <p className="mt-4">
          <a href={tutorial!.tutorial_pdf_url} target="_blank" rel="noreferrer">
            Open the tutorial PDF
          </a>
        </p>
      )}

      <form action={approve} className="mt-8">
        <input type="hidden" name="tutorialId" value={tutorialId} />
        <input type="hidden" name="orgId" value={orgId} />
        <button type="submit" className="btn btn-accent btn-block">
          Approve and publish
        </button>
      </form>

      <form action={reject} className="mt-6">
        <input type="hidden" name="tutorialId" value={tutorialId} />
        <input type="hidden" name="orgId" value={orgId} />
        <label htmlFor="note" className="block font-medium text-ink">
          Why are you rejecting this?
        </label>
        <textarea id="note" name="note" required rows={4} className="mt-2 w-full" />
        <p className="mt-1 text-xs text-muted">
          The contributor sees this. It is required.
        </p>
        <button type="submit" className="btn btn-block mt-3">
          Reject
        </button>
      </form>
    </div>
  )
}

/**
 * Organisation Leader Project Page
 *
 * ONE page for everything a leader does with one project. Which actions appear is
 * derived from (backing state, tutorial state) via leaderActions — never from
 * which route was opened.
 *
 * That derivation is the fix for a real hole. This page used to refuse anything
 * not already pending-and-accepted, and the queue linked pending requests to
 * /tutorials/[id] — the PUBLIC page, which serves only approved work. A leader
 * asked to back a project got a 404 on the one thing they had to read first.
 *
 * Related files:
 * - components/project-actions.tsx: the action matrix
 * - packages/api/src/routes/tutorial-orgs.ts: accept, decline, review
 * - app/admin/review/[id]/page.tsx: the same shape with the admin's authority
 */
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Image from 'next/image'
import { apiClient } from '@/lib/api-client'
import { isOrgLeader } from '@/lib/org-access'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { leaderActions } from '@/components/project-actions'
import { BackingBadge } from '@/components/backing-state'
import type { TutorialWithDetails, Organization, TutorialOrg } from '@splat-connect/types'

type Reviewed = TutorialWithDetails & {
  reviewer?: { name: string } | null
  reviewed_for?: { name: string } | null
}

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

async function backProject(formData: FormData) {
  'use server'
  const orgId = formData.get('orgId') as string
  const tutorialId = formData.get('tutorialId') as string
  await apiClient.post(`/api/tutorials/${tutorialId}/orgs/${orgId}/accept`, {})
  revalidatePath(`/organizations/${orgId}`)
  revalidatePath(`/organizations/${orgId}/projects/${tutorialId}`)
}

async function declineProject(formData: FormData) {
  'use server'
  const orgId = formData.get('orgId') as string
  const tutorialId = formData.get('tutorialId') as string
  await apiClient.post(`/api/tutorials/${tutorialId}/orgs/${orgId}/decline`, {})
  revalidatePath(`/organizations/${orgId}`)
  redirect(`/organizations/${orgId}`)
}

export default async function LeaderProjectPage({
  params,
}: {
  params: Promise<{ id: string; tutorialId: string }>
}) {
  const { id: orgId, tutorialId } = await params
  // A non-leader gets a 404 rather than a redirect: this URL is a workspace, not a
  // public face, and there is nothing here to show them.
  if (!(await isOrgLeader(orgId))) notFound()
  const org = await apiClient.get<Organization>(`/api/organizations/${orgId}`)

  let tutorial: Reviewed
  try {
    tutorial = await apiClient.get<Reviewed>(`/api/tutorials/${tutorialId}`)
  } catch {
    notFound()
  }

  const backingRows = await apiClient
    .get<TutorialOrg[]>(`/api/tutorials/${tutorialId}/orgs`)
    .catch(() => [] as TutorialOrg[])
  const mine = backingRows.find((b) => b.org_id === orgId) ?? null
  const actions = leaderActions(mine?.status ?? null, tutorial!.status)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">For {org.name}</p>
        {mine && <BackingBadge status={mine.status} />}
      </div>
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

      {actions.includes('back') && (
        <div className="mt-8">
          <p className="max-w-prose text-sm leading-relaxed text-muted">
            Backing this means your organisation will review it. You are agreeing to
            look, not to publish.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={backProject}>
              <input type="hidden" name="tutorialId" value={tutorialId} />
              <input type="hidden" name="orgId" value={orgId} />
              <button type="submit" className="btn btn-accent">Back this project</button>
            </form>
            <form action={declineProject}>
              <input type="hidden" name="tutorialId" value={tutorialId} />
              <input type="hidden" name="orgId" value={orgId} />
              <button type="submit" className="btn btn-quiet">Decline</button>
            </form>
          </div>
        </div>
      )}

      {actions.includes('approve') && (
        <form action={approve} className="mt-8">
          <input type="hidden" name="tutorialId" value={tutorialId} />
          <input type="hidden" name="orgId" value={orgId} />
          {/* Said plainly, because this is the action with consequences outside the
              platform: it puts the organisation's name on work parents will use. */}
          <p className="max-w-prose text-sm leading-relaxed text-muted">
            This publishes the tutorial to the library under {org.name}&apos;s name.
          </p>
          <button type="submit" className="btn btn-accent mt-3">Approve and publish</button>
        </form>
      )}

      {actions.includes('reject') && (
        <form action={reject} className="mt-6">
          <input type="hidden" name="tutorialId" value={tutorialId} />
          <input type="hidden" name="orgId" value={orgId} />
          <label htmlFor="note" className="block font-medium text-ink">
            Why are you rejecting this?
          </label>
          <textarea id="note" name="note" required rows={4} className="mt-2 w-full" />
          <p className="mt-1 text-xs text-muted">The contributor sees this. It is required.</p>
          <button type="submit" className="btn btn-quiet mt-3">Reject</button>
        </form>
      )}

      {actions.length === 0 && (
        <p className="alert mt-8 max-w-prose">
          {tutorial!.status === 'approved'
            ? `Published${tutorial!.reviewer ? ` — approved by ${tutorial!.reviewer.name}` : ''}${tutorial!.reviewed_for ? `, ${tutorial!.reviewed_for.name}` : ''}. Only SPLAT can take it down.`
            : mine?.status === 'declined'
              ? `${org.name} declined this project.`
              : `${org.name} has not been asked to back this project.`}
        </p>
      )}
    </div>
  )
}

import { BackLink } from '@/components/back-link'
import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'
import { requireCapabilities } from '@/lib/require-capabilities'
import { revalidatePath } from 'next/cache'
import { Suspense } from 'react'
import { EditFilesSection } from '@/components/edit-files-section'
import { AddStlForm } from '@/components/add-stl-form'
import { EditItemsSection, type ItemInput } from '@/components/edit-items-section'
import { EditBackingSection } from '@/components/edit-backing-section'
import { EditDetailsSection } from '@/components/edit-details-section'
import { EditCollaboratorsSection } from '@/components/edit-collaborators-section'
import { EditRecommendationsSection } from '@/components/edit-recommendations-section'
import { Stepper } from '@/components/stepper'
import { CreatedToast } from '@/components/created-toast'
import { ToastProvider } from '@/components/toast'
import { TutorialReviewPanel } from '@/components/tutorial-review-panel'
import { computeStepStatuses, stepsFor, type EditStep } from '@/lib/edit-steps'
import { getMissingFields } from '@/lib/validation'
import { SaveStatusLine } from '@/components/save-status-line'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import type { Tutorial, Part, Tool, StlFile, TutorialWithDetails, Difficulty, TutorialKind, BuyLink, TutorialOrg, Organization , TutorialMaturity } from '@splat-connect/types'

export default async function EditTutorialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { profile } = await requireCapabilities()

  let tutorial: TutorialWithDetails
  try {
    tutorial = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
  } catch {
    redirect('/dashboard')
  }

  const isContributor = tutorial.tutorial_contributors.some(
    (tc) => tc.profile_id === profile.id
  )
  if (!isContributor) redirect('/dashboard')

  const parts = tutorial.parts as Part[]
  const tools = tutorial.tools as Tool[]
  const stlFiles = tutorial.stl_files as StlFile[]

  // Backing rows and the organisation list for the picker. Both tolerate failure:
  // a backing panel that cannot load is a worse reason to 500 the whole edit page
  // than it is to render empty.
  // The recommendation picker's choices ride along on the same terms: approved
  // tutorials from the public list, which is already exactly the set a parent
  // could follow a recommendation to.
  const [backing, organizations, candidates] = await Promise.all([
    apiClient.get<TutorialOrg[]>(`/api/tutorials/${id}/orgs`).catch(() => [] as TutorialOrg[]),
    apiClient.get<Organization[]>('/api/organizations').catch(() => [] as Organization[]),
    apiClient.get<Tutorial[]>('/api/public/tutorials').catch(() => [] as Tutorial[]),
  ])

  async function askOrg(orgId: string) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/orgs`, { org_id: orgId })
    revalidatePath(`/tutorials/${id}/edit`)
    revalidatePath('/dashboard')
  }

  async function withdrawOrg(orgId: string) {
    'use server'
    await apiClient.delete(`/api/tutorials/${id}/orgs/${orgId}`)
    revalidatePath(`/tutorials/${id}/edit`)
    revalidatePath('/dashboard')
  }

  async function saveDetails(patch: { title: string; description: string | null; difficulty: Difficulty; kind: TutorialKind; maturity: TutorialMaturity; safety_declared?: true; updated_at: string }) {
    'use server'
    const body: Record<string, unknown> = { ...patch }
    if (tutorial.status === 'approved' || tutorial.status === 'rejected') {
      body.status = 'pending'
    }
    await apiClient.patch(`/api/tutorials/${id}`, body)
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function inviteCollaborator(emailAddr: string) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/collaborators/invite`, { email: emailAddr })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function removeCollaborator(profileId: string) {
    'use server'
    await apiClient.delete(`/api/tutorials/${id}/collaborators/${profileId}`)
    revalidatePath(`/tutorials/${id}/edit`)
  }

  // Receives only string URLs (no file bytes) — no Server Action body size limit risk.
  // File bytes are uploaded directly browser -> Hono API by EditFilesSection.
  async function patchFileUrls(pdfUrl: string | null) {
    'use server'
    return patchFiles({ tutorial_pdf_url: pdfUrl })
  }

  // Photos save one at a time as they are added or removed, so they get their
  // own action rather than riding along with the PDF's Save button.
  async function patchPhotoUrls(photoUrls: string[]) {
    'use server'
    return patchFiles({ photo_urls: photoUrls })
  }

  async function patchFiles(updates: Record<string, unknown>) {
    'use server'
    // Read first for updated_at: the tutorials PATCH takes it as an optimistic
    // lock, so a save built on a stale copy is refused rather than silently
    // overwriting a collaborator.
    const current = await apiClient.get<Tutorial>(`/api/tutorials/${id}`)
    if (current.status === 'approved' || current.status === 'rejected') {
      updates.status = 'pending'
    }
    await apiClient.patch(`/api/tutorials/${id}`, { ...updates, updated_at: current.updated_at })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  // Takes ItemInput, the exact type EditItemsSection emits, so it can be handed
  // over as-is.
  //
  // WHY: it previously required `quantity: number` while ItemInput declares it
  //      optional, so the call site wrapped this in `(items) => saveParts(items
  //      as ...)`. That arrow is an ordinary function, not a server action —
  //      React rejects it with "Event handlers cannot be passed to Client
  //      Component props" and the whole edit page 500s. Tools was unaffected
  //      only because its types lined up and it needed no wrapper.
  // HOW: widening the parameter removes the reason for the wrapper, and the
  //      default below states the guarantee EditItemsSection already makes at
  //      runtime (it always sets quantity when withQuantity is on) instead of
  //      casting it away.
  async function saveParts(newParts: ItemInput[]) {
    'use server'
    const parts = newParts.map((p) => ({ ...p, quantity: p.quantity ?? 1 }))
    await apiClient.post(`/api/tutorials/${id}/parts`, { parts })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function saveTools(newTools: { name: string; is_optional: boolean; buy_links: BuyLink[] }[]) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/tools`, { tools: newTools })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  // Receives only filename + URL strings — no file bytes, no size limit risk.
  async function addStlFileRecord(filename: string, fileUrl: string) {
    'use server'
    const current = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
    await apiClient.post(`/api/tutorials/${id}/stl-files`, {
      stl_files: [...current.stl_files, { filename, file_url: fileUrl }],
    })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function saveRecommendations(recommendedIds: string[]) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/recommendations`, {
      recommendations: recommendedIds.map((recommended_id) => ({ recommended_id })),
    })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function submitForReview() {
    'use server'
    const current = await apiClient.get<Tutorial>(`/api/tutorials/${id}`)
    await apiClient.patch(`/api/tutorials/${id}`, { status: 'pending', updated_at: current.updated_at })
    revalidatePath(`/tutorials/${id}/edit`)
  }


  const missing = getMissingFields(tutorial!)
  const stepStatuses = computeStepStatuses(tutorial!, backing)

  // Every step this page knows how to draw. Which of them show, and in what
  // order, is stepsFor()'s answer below — the STL step exists only for an
  // assistive-tech tutorial, and /upload draws its locked preview from the
  // same list so the two never disagree.
  const allSteps: EditStep[] = [
    {
      id: 'details',
      label: 'Details',
      status: stepStatuses.details,
      content: (
        <div className="panel pt-5">
          <EditDetailsSection tutorial={tutorial!} onSave={saveDetails} />
        </div>
      ),
    },
    {
      id: 'files',
      label: 'Files',
      status: stepStatuses.files,
      content: (
        <div className="panel pt-5">
          <EditFilesSection
            tutorialId={id}
            photoUrls={tutorial.photo_urls}
            currentPdfUrl={tutorial.tutorial_pdf_url}
            onSavePhotos={patchPhotoUrls}
            onSave={patchFileUrls}
          />
        </div>
      ),
    },
    {
      id: 'parts',
      label: 'Parts',
      status: stepStatuses.parts,
      content: (
        <div className="panel pt-5">
          {/* Passed directly, never wrapped in an arrow: a server action loses
              its marker the moment it is wrapped, and the page 500s. */}
          <EditItemsSection
            noun="part"
            withQuantity
            initialItems={parts}
            onSave={saveParts}
          />
        </div>
      ),
    },
    {
      id: 'tools',
      label: 'Tools',
      status: stepStatuses.tools,
      content: (
        <div className="panel pt-5">
          <EditItemsSection noun="tool" initialItems={tools} onSave={saveTools} />
        </div>
      ),
    },
    {
      id: 'stl',
      label: 'STL Files',
      status: stepStatuses.stl,
      content: (
        <div className="panel px-5 pt-5 pb-5">
          {stlFiles.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {stlFiles.map((f) => (
                <li key={f.id} className="card-flat px-4 py-3 text-sm">
                  <a
                    href={`/files/stl-files/${f.file_url}`}
                    className="font-semibold text-brand-dark hover:underline"
                  >
                    {f.filename}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <AddStlForm tutorialId={id} onAdd={addStlFileRecord} />
        </div>
      ),
    },
    {
      id: 'review',
      label: 'Review',
      status: stepStatuses.review,
      content: (
        <TutorialReviewPanel
          title={tutorial.title}
          description={tutorial.description}
          difficulty={tutorial.difficulty as Difficulty}
          toyPhotoUrl={tutorial.toy_photo_url}
          hasPdf={tutorial.tutorial_pdf_url !== null}
          partCount={parts.length}
          toolCount={tools.length}
          stlCount={stlFiles.length}
          backing={backing}
        />
      ),
    },
    {
      id: 'recommended',
      label: 'Recommended',
      status: stepStatuses.recommended,
      content: (
        <div className="panel pt-5">
          <h2 className="px-5 pb-3 text-sm font-bold text-ink">Recommended tutorials</h2>
          <EditRecommendationsSection
            tutorialId={id}
            recommendations={tutorial.tutorial_recommendations}
            candidates={candidates}
            onSave={saveRecommendations}
          />
        </div>
      ),
    },
    {
      id: 'team',
      label: 'Team',
      status: stepStatuses.team,
      // Beside the walk, not on it: the pill sits at the right end of the
      // rail in its own colour, nothing offers it as Next, and it carries no
      // finish bar. Review is where a contributor is asked whether they want
      // it. See Step.offWalk.
      offWalk: true,
      content: (
        // Two cards rather than one, because they are two separate asks — you
        // invite a person, you ask an organisation — and the heading each one
        // now carries is the one the pill used to give it.
        <div className="flex flex-col gap-4">
          <div className="panel pt-5">
            <h2 className="px-5 pb-3 text-sm font-bold text-ink">Collaborators</h2>
            <EditCollaboratorsSection
              contributors={tutorial.tutorial_contributors}
              invites={tutorial.tutorial_collaborator_invites ?? []}
              currentProfileId={profile.id}
              isPrimary={tutorial.tutorial_contributors.some(
                (tc) => tc.profile_id === profile.id && tc.role === 'primary'
              )}
              onInvite={inviteCollaborator}
              onRemove={removeCollaborator}
            />
          </div>
          <div className="panel pt-5">
            <h2 className="px-5 pb-3 text-sm font-bold text-ink">Backing</h2>
            <EditBackingSection
              backing={backing}
              organizations={organizations}
              tutorialStatus={tutorial.status}
              reviewedForOrgId={tutorial.reviewed_for_org_id}
              onAsk={askOrg}
              onWithdraw={withdrawOrg}
            />
          </div>
        </div>
      ),
    },
  ]
  const steps = stepsFor(tutorial.kind).map((stepId) => allSteps.find((s) => s.id === stepId)!)

  return (
    <div>
      <div className="mb-6">
        <BackLink href="/dashboard/tutorials" label="My tutorials" />
        <h1 className="truncate title-detail">{tutorial.title}</h1>
      </div>

      {/* Rendered only on a draft, and absent rather than disabled off one.
          RLS (001_schema.sql "Contributors can delete own draft tutorials")
          refuses the delete on every other status, so a control here would be
          one that cannot work -- and "how do I enable it?" has no answer worth
          giving. Web had no tutorial delete at all before this, which left an
          abandoned draft unremovable from the surface it was written on. */}
      {tutorial.status === 'draft' && (
        <div className="mb-6">
          <DeleteEntityButton
            endpoint={`/api/tutorials/${id}`}
            redirectTo="/dashboard/tutorials"
            label="draft"
          />
        </div>
      )}

      {tutorial.status === 'rejected' && (
        <div className="alert alert-danger mb-3">
          <p className="mb-1 font-bold">This tutorial was rejected</p>
          <p className="leading-relaxed">
            {tutorial.rejection_note ?? 'No feedback was provided.'}
          </p>
        </div>
      )}

      {/* useSearchParams() inside Stepper and CreatedToast requires a Suspense
          boundary, or `next build` fails to prerender this page — same
          reasoning as app/onboarding/contributor-terms/page.tsx.

          ToastProvider sits here rather than inside the stepper: every panel's
          save announces itself through it, and so does the arrival from
          /upload, which is the one thing the stepper never had a reason to
          know about. */}
      <Suspense>
        <ToastProvider>
          <CreatedToast />
          <Stepper
            steps={steps}
            label="Tutorial sections"
            finish={{
              missing,
              submitLabel: 'Submit for review',
              busyLabel: 'Submitting…',
              errorMessage: 'Could not submit this tutorial. Please try again.',
              endLabel: 'Review and submit',
              onSubmit: submitForReview,
              // Once it has left the contributor's hands there is nothing to
              // finish, so the bar carries the last-saved line instead.
              done:
                tutorial.status === 'draft' ? undefined : (
                  <SaveStatusLine savedAt={tutorial.updated_at} />
                ),
            }}
          />
        </ToastProvider>
      </Suspense>
    </div>
  )
}

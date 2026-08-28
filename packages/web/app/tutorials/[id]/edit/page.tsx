import { BackLink } from '@/components/back-link'
import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Suspense } from 'react'
import { EditFilesSection } from '@/components/edit-files-section'
import { AddStlForm } from '@/components/add-stl-form'
import { EditItemsSection, type ItemInput } from '@/components/edit-items-section'
import { EditBackingSection } from '@/components/edit-backing-section'
import { EditDetailsSection } from '@/components/edit-details-section'
import { EditCollaboratorsSection } from '@/components/edit-collaborators-section'
import { EditStepper } from '@/components/edit-stepper'
import { TutorialReviewPanel } from '@/components/tutorial-review-panel'
import { computeStepStatuses, type EditStep } from '@/lib/edit-steps'
import { getMissingFields } from '@/lib/validation'
import type { Tutorial, Part, Tool, StlFile, TutorialWithDetails, Difficulty, BuyLink, Profile, TutorialOrg, Organization } from '@splat-connect/types'

export default async function EditTutorialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let profile: Profile
  try {
    profile = await apiClient.get<Profile>('/api/contributors/me')
  } catch {
    redirect('/login')
  }

  let tutorial: TutorialWithDetails
  try {
    tutorial = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
  } catch {
    redirect('/dashboard')
  }

  const isContributor = tutorial!.tutorial_contributors.some(
    (tc) => tc.profile_id === profile!.id
  )
  if (!isContributor) redirect('/dashboard')

  const parts = tutorial!.parts as Part[]
  const tools = tutorial!.tools as Tool[]
  const stlFiles = tutorial!.stl_files as StlFile[]

  // Backing rows and the organisation list for the picker. Both tolerate failure:
  // a backing panel that cannot load is a worse reason to 500 the whole edit page
  // than it is to render empty.
  const [backing, organizations] = await Promise.all([
    apiClient.get<TutorialOrg[]>(`/api/tutorials/${id}/orgs`).catch(() => [] as TutorialOrg[]),
    apiClient.get<Organization[]>('/api/organizations').catch(() => [] as Organization[]),
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

  async function saveDetails(patch: { title: string; description: string | null; difficulty: Difficulty; updated_at: string }) {
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
  async function patchFileUrls(photoUrl: string | null, pdfUrl: string | null) {
    'use server'
    const updates: Record<string, string | null> = {
      toy_photo_url: photoUrl,
      tutorial_pdf_url: pdfUrl,
    }
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

  async function submitForReview() {
    'use server'
    const current = await apiClient.get<Tutorial>(`/api/tutorials/${id}`)
    await apiClient.patch(`/api/tutorials/${id}`, { status: 'pending', updated_at: current.updated_at })
    revalidatePath(`/tutorials/${id}/edit`)
  }


  const missingFields = getMissingFields(tutorial!)
  const stepStatuses = computeStepStatuses(tutorial!, backing)

  const steps: EditStep[] = [
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
            currentPhotoUrl={tutorial!.toy_photo_url}
            currentPdfUrl={tutorial!.tutorial_pdf_url}
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
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
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
      id: 'backing',
      label: 'Backing',
      status: stepStatuses.backing,
      content: (
        <div className="panel pt-5">
          <EditBackingSection
            backing={backing}
            organizations={organizations}
            tutorialStatus={tutorial!.status}
            reviewedForOrgId={tutorial!.reviewed_for_org_id}
            onAsk={askOrg}
            onWithdraw={withdrawOrg}
          />
        </div>
      ),
    },
    {
      id: 'collaborators',
      label: 'Collaborators',
      status: stepStatuses.collaborators,
      content: (
        <div className="panel pt-5">
          <EditCollaboratorsSection
            contributors={tutorial!.tutorial_contributors}
            currentProfileId={profile!.id}
            isPrimary={tutorial!.tutorial_contributors.some(
              (tc) => tc.profile_id === profile!.id && tc.role === 'primary'
            )}
            onInvite={inviteCollaborator}
            onRemove={removeCollaborator}
          />
        </div>
      ),
    },
    {
      id: 'review',
      label: 'Review',
      status: stepStatuses.review,
      content: (
        <TutorialReviewPanel
          title={tutorial!.title}
          description={tutorial!.description}
          difficulty={tutorial!.difficulty as Difficulty}
          toyPhotoUrl={tutorial!.toy_photo_url}
          hasPdf={tutorial!.tutorial_pdf_url !== null}
          partCount={parts.length}
          toolCount={tools.length}
          stlCount={stlFiles.length}
          backing={backing}
          status={tutorial!.status}
          updatedAt={tutorial!.updated_at}
          missingFields={missingFields}
          onSubmit={submitForReview}
        />
      ),
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <BackLink href="/dashboard/tutorials" label="My tutorials" />
        <h1 className="truncate text-2xl font-bold text-ink">{tutorial!.title}</h1>
      </div>

      {tutorial!.status === 'rejected' && (
        <div className="alert alert-danger mb-3">
          <p className="mb-1 font-bold">This tutorial was rejected</p>
          <p className="leading-relaxed">
            {tutorial!.rejection_note ?? 'No feedback was provided.'}
          </p>
        </div>
      )}

      {/* useSearchParams() inside EditStepper requires a Suspense boundary, or
          `next build` fails to prerender this page — same reasoning as
          app/onboarding/contributor-terms/page.tsx. */}
      <Suspense>
        <EditStepper steps={steps} />
      </Suspense>
    </div>
  )
}

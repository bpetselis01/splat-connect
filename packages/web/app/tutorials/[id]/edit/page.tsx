import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { EditFilesSection } from '@/components/edit-files-section'
import { AddStlForm } from '@/components/add-stl-form'
import { EditPartsSection } from '@/components/edit-parts-section'
import { EditToolsSection } from '@/components/edit-tools-section'
import { SubmitForReviewButton } from '@/components/submit-for-review-button'
import { EditBackingSection } from '@/components/edit-backing-section'
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

  async function saveDetails(formData: FormData) {
    'use server'
    const current = await apiClient.get<Tutorial>(`/api/tutorials/${id}`)
    const patch: Record<string, string | null> = {
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      difficulty: formData.get('difficulty') as Difficulty,
    }
    if (current.status === 'approved' || current.status === 'rejected') {
      patch.status = 'pending'
    }
    await apiClient.patch(`/api/tutorials/${id}`, patch)
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
    await apiClient.patch(`/api/tutorials/${id}`, updates)
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function saveParts(newParts: { name: string; quantity: number; is_optional: boolean; buy_links: BuyLink[] }[]) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/parts`, { parts: newParts })
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
    await apiClient.patch(`/api/tutorials/${id}`, { status: 'pending' })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  const inputCls = 'field'
  const saveBtnCls = 'btn btn-primary btn-sm self-end'
  const panelCls = 'panel mb-3'
  const summaryCls = 'panel-summary'

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-brand-dark hover:underline"
        >
          &larr; Dashboard
        </Link>
        <h1 className="truncate text-xl font-bold text-ink">{tutorial!.title}</h1>
      </div>

      {tutorial!.status === 'rejected' && (
        <div className="alert alert-danger mb-3">
          <p className="mb-1 font-bold">This tutorial was rejected</p>
          <p className="leading-relaxed">
            {tutorial!.rejection_note ?? 'No feedback was provided.'}
          </p>
        </div>
      )}

      {/* Submit for review -- draft only */}
      {tutorial!.status === 'draft' && (
        <div className={`${panelCls} px-5 py-4`}>
          <p className="mb-3 text-sm leading-relaxed text-muted">
            Once all required fields are filled, submit this tutorial for admin review.
          </p>
          <SubmitForReviewButton tutorial={tutorial!} action={submitForReview} />
        </div>
      )}

      {/* Details */}
      <details className={panelCls} open>
        <summary className={summaryCls}>Details</summary>
        <form action={saveDetails} className="flex flex-col gap-3 px-5 pb-5">
          <div>
            <label htmlFor="edit-title" className="field-label">Title</label>
            <input id="edit-title" name="title" defaultValue={tutorial!.title} required className={inputCls} />
          </div>
          <div>
            <label htmlFor="edit-description" className="field-label">Description</label>
            <textarea
              id="edit-description"
              name="description"
              defaultValue={tutorial!.description ?? ''}
              rows={4}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-difficulty" className="field-label">Difficulty</label>
            {/* WHY: After saving details, the difficulty dropdown shows the old selection
                 instead of the newly saved one.
                HOW: The key prop forces the dropdown to rebuild from scratch whenever
                     the saved difficulty changes, picking up the fresh value. */}
            <select id="edit-difficulty" key={tutorial!.difficulty} name="difficulty" defaultValue={tutorial!.difficulty} className={inputCls}>
              {/* WHY: The old values ("beginner", "intermediate", "advanced") didn't match
                       the database — saves were silently ignored by the check constraint.
                  HOW: The database only accepts "easy", "medium", or "hard" for difficulty. */}
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <button type="submit" className={saveBtnCls}>
            Save details
          </button>
        </form>
      </details>

      {/* Files — handled by a client component that uploads directly to the API,
          then passes only the resulting URL string to patchFileUrls.
          This avoids the 1 MB Server Action body size limit for file bytes. */}
      <details className={panelCls}>
        <summary className={summaryCls}>Files</summary>
        <EditFilesSection
          tutorialId={id}
          currentPhotoUrl={tutorial!.toy_photo_url}
          currentPdfUrl={tutorial!.tutorial_pdf_url}
          onSave={patchFileUrls}
        />
      </details>

      {/* Parts */}
      <details className={panelCls}>
        <summary className={summaryCls}>Parts ({parts.length})</summary>
        <div className="px-5 pb-5">
          <EditPartsSection initialParts={parts} onSave={saveParts} />
        </div>
      </details>

      {/* Tools */}
      <details className={panelCls}>
        <summary className={summaryCls}>Tools ({tools.length})</summary>
        <div className="px-5 pb-5">
          <EditToolsSection initialTools={tools} onSave={saveTools} />
        </div>
      </details>

      {/* STL Files -- AddStlForm uploads directly to the API (no Server Action body limit risk) */}
      <details className={panelCls}>
        <summary className={summaryCls}>STL Files ({stlFiles.length})</summary>
        <div className="px-5 pb-5">
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
      </details>

      {/* Backing — last, deliberately. The panels above are what the project IS;
          this is who stands behind it, and it is the least frequently touched.
          Leading with a panel carrying pending state would pull attention to the
          thing a contributor can do least about.

          The summary carries the STATE, not a count, unlike every panel above it.
          "Backing (2)" answers a question nobody asked; what a contributor wants
          from a shut accordion is whether anyone said yes. */}
      <details className={panelCls}>
        <summary className={summaryCls}>
          Backing
          {backing.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              {backing.some((b) => b.status === 'accepted')
                ? 'backed'
                : backing.some((b) => b.status === 'pending')
                  ? 'waiting'
                  : 'declined'}
            </span>
          )}
        </summary>
        <EditBackingSection
          backing={backing}
          organizations={organizations}
          tutorialStatus={tutorial!.status}
          reviewedForOrgId={tutorial!.reviewed_for_org_id}
          onAsk={askOrg}
          onWithdraw={withdrawOrg}
        />
      </details>
    </div>
  )
}
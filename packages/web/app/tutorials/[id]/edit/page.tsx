import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { EditFilesSection } from '@/components/edit-files-section'
import { AddStlForm } from '@/components/add-stl-form'
import { EditPartsSection } from '@/components/edit-parts-section'
import { EditToolsSection } from '@/components/edit-tools-section'
import { SubmitForReviewButton } from '@/components/submit-for-review-button'
import type { Tutorial, Part, Tool, StlFile, TutorialWithDetails, Difficulty, BuyLink, Profile } from '@splat-connect/types'

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

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm'
  const saveBtnCls =
    'self-end bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#16304f]'
  const panelCls = 'bg-white border rounded-xl mb-3'
  const summaryCls = 'px-5 py-4 font-semibold cursor-pointer select-none list-none'

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          &larr; Dashboard
        </Link>
        <h1 className="text-xl font-bold truncate">{tutorial!.title}</h1>
      </div>

      {tutorial!.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-3">
          <p className="text-sm font-semibold text-red-700 mb-1">This tutorial was rejected</p>
          <p className="text-sm text-red-600">
            {tutorial!.rejection_note ?? 'No feedback was provided.'}
          </p>
        </div>
      )}

      {/* Submit for review -- draft only */}
      {tutorial!.status === 'draft' && (
        <div className={`${panelCls} px-5 py-4`}>
          <p className="text-sm text-gray-600 mb-3">
            Once all required fields are filled, submit this tutorial for admin review.
          </p>
          <SubmitForReviewButton tutorial={tutorial!} action={submitForReview} />
        </div>
      )}

      {/* Details */}
      <details className={panelCls} open>
        <summary className={summaryCls}>Details</summary>
        <form action={saveDetails} className="px-5 pb-5 flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input name="title" defaultValue={tutorial!.title} required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              defaultValue={tutorial!.description ?? ''}
              rows={4}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Difficulty</label>
            {/* WHY: After saving details, the difficulty dropdown shows the old selection
                 instead of the newly saved one.
                HOW: The key prop forces the dropdown to rebuild from scratch whenever
                     the saved difficulty changes, picking up the fresh value. */}
            <select key={tutorial!.difficulty} name="difficulty" defaultValue={tutorial!.difficulty} className={inputCls}>
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
                <li key={f.id} className="text-sm border rounded-lg px-3 py-2">
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
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
    </div>
  )
}
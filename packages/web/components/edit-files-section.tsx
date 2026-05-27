/**
 * Edit Files Section Component
 * 
 * Allows editing tutorial files (photo and PDF) after creation.
 * Used in the tutorial editor page to replace existing files.
 * 
 * Props:
 * - tutorialId: ID of tutorial being edited
 * - currentPhotoUrl: Current toy photo URL (if any)
 * - currentPdfUrl: Current tutorial PDF URL (if any)
 * - onSave: Callback when files are saved
 * 
 * Features:
 * - Upload new photo or PDF via drag-and-drop
 * - Shows existing files
 * - "Save" button only enabled if changes made
 * - Handles upload progress and errors
 * 
 * Process:
 * 1. User selects new file via FileDropZone
 * 2. File preview/name shown immediately
 * 3. User clicks "Save Changes"
 * 4. Form uploads file to /api/upload
 * 5. Server uploads to Supabase Storage, returns file_url
 * 6. Form calls PATCH /api/tutorials/:id with new file URLs
 * 7. onSave callback fires
 * 8. Parent page refreshes to show updated files
 * 
 * Related files:
 * - components/file-drop-zone.tsx: UI for file selection
 * - routes/upload.ts: File upload to Supabase Storage
 * - routes/tutorials.ts: PATCH endpoint to update tutorial
 */
'use client'
import { useState, useTransition } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { FileDropZone } from '@/components/file-drop-zone'

export function EditFilesSection({
  tutorialId,
  currentPhotoUrl,
  currentPdfUrl,
  onSave,
}: {
  tutorialId: string
  currentPhotoUrl: string | null
  currentPdfUrl: string | null
  onSave: (photoUrl: string | null, pdfUrl: string | null) => Promise<void>
}) {
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl)
  const [pdfUrl, setPdfUrl] = useState(currentPdfUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, startTransition] = useTransition()

  const hasChanges = photoUrl !== currentPhotoUrl || pdfUrl !== currentPdfUrl

  async function uploadFile(endpoint: string, file: File): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tutorialId', tutorialId)
    const { url } = await browserApiClient.postFormData<{ url: string }>(endpoint, fd)
    return url
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      setPhotoUrl(await uploadFile('/api/upload/photo', file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      setPdfUrl(await uploadFile('/api/upload/pdf', file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleSave() {
    if (!hasChanges) return
    startTransition(async () => {
      await onSave(photoUrl, pdfUrl)
    })
  }

  const btnCls =
    'self-end bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#16304f] disabled:opacity-50'

  return (
    <div className="px-5 pb-5 flex flex-col gap-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div>
        <label className="block text-sm font-medium mb-2">Replace toy photo</label>
        <FileDropZone
          name="toy_photo"
          accept="image/*"
          label="Toy Photo"
          onChange={handlePhotoChange}
          currentFileLabel={photoUrl ? 'Current photo on file — upload to replace' : undefined}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Replace tutorial PDF</label>
        <FileDropZone
          name="tutorial_pdf"
          accept=".pdf"
          label="Tutorial PDF"
          onChange={handlePdfChange}
          currentFileLabel={pdfUrl ? 'Current PDF on file — upload to replace' : undefined}
        />
      </div>
      {uploading && <p className="text-blue-600 text-sm">Uploading…</p>}
      <button
        type="button"
        disabled={!hasChanges || uploading || saving}
        onClick={handleSave}
        className={btnCls}
      >
        {saving ? 'Saving…' : 'Save files'}
      </button>
    </div>
  )
}

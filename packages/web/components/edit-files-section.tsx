'use client'
import { useState } from 'react'
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
  // WHY: Previously, picking a file immediately uploaded it to cloud storage —
  //      files were being saved even if the user cancelled or changed their mind.
  // HOW: Files are held in memory as File objects and only uploaded when the
  //      Save button is clicked.
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = photoFile !== null || pdfFile !== null

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPdfFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  async function uploadFile(endpoint: string, file: File): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tutorialId', tutorialId)
    const { url } = await browserApiClient.postFormData<{ url: string }>(endpoint, fd)
    return url
  }

  async function handleSave() {
    if (!hasChanges || saving) return
    setSaving(true)
    setError(null)
    try {
      const newPhotoUrl = photoFile
        ? await uploadFile('/api/upload/photo', photoFile)
        : currentPhotoUrl
      const newPdfUrl = pdfFile
        ? await uploadFile('/api/upload/pdf', pdfFile)
        : currentPdfUrl
      await onSave(newPhotoUrl, newPdfUrl)
      setPhotoFile(null)
      setPdfFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
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
          currentFileLabel={currentPhotoUrl ? 'Current photo on file — upload to replace' : undefined}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Replace tutorial PDF</label>
        <FileDropZone
          name="tutorial_pdf"
          accept=".pdf"
          label="Tutorial PDF"
          onChange={handlePdfChange}
          currentFileLabel={currentPdfUrl ? 'Current PDF on file — upload to replace' : undefined}
        />
      </div>
      {saving && <p className="text-blue-600 text-sm">Saving…</p>}
      <button
        type="button"
        disabled={!hasChanges || saving}
        onClick={handleSave}
        className={btnCls}
      >
        Save files
      </button>
    </div>
  )
}

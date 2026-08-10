'use client'
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { FileDropZone } from '@/components/file-drop-zone'
import { useToast } from '@/components/toast'

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
  const showToast = useToast()
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
      showToast('Files saved')
      setPhotoFile(null)
      setPdfFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const btnCls = 'btn btn-primary btn-sm self-end'

  return (
    <div className="flex flex-col gap-4 px-5 pb-5">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <div>
        <label className="field-label" htmlFor="toy_photo">Replace toy photo</label>
        <FileDropZone
          id="toy_photo"
          name="toy_photo"
          accept="image/*"
          label="Toy Photo"
          onChange={handlePhotoChange}
          currentFileLabel={currentPhotoUrl ? 'Current photo on file — upload to replace' : undefined}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="tutorial_pdf">Replace tutorial PDF</label>
        <FileDropZone
          id="tutorial_pdf"
          name="tutorial_pdf"
          accept=".pdf"
          label="Tutorial PDF"
          onChange={handlePdfChange}
          currentFileLabel={currentPdfUrl ? 'Current PDF on file — upload to replace' : undefined}
        />
      </div>
      {saving && <p className="text-sm font-semibold text-brand-dark">Saving…</p>}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!hasChanges || saving}
          onClick={handleSave}
          className={btnCls}
        >
          Save files
        </button>
      </div>
    </div>
  )
}

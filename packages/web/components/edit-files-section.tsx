'use client'
import { PanelActions, useSaveOnLeave } from '@/components/panel-actions'
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { FileDropZone } from '@/components/file-drop-zone'
import { PhotoTiles } from '@/components/photo-tiles'
import { useToast } from '@/components/toast'

export function EditFilesSection({
  tutorialId,
  photoUrls,
  currentPdfUrl,
  onSavePhotos,
  onSave,
}: {
  tutorialId: string
  photoUrls: string[]
  currentPdfUrl: string | null
  onSavePhotos: (photoUrls: string[]) => Promise<void>
  onSave: (pdfUrl: string | null) => Promise<void>
}) {
  // WHY: Previously, picking a file immediately uploaded it to cloud storage —
  //      files were being saved even if the user cancelled or changed their mind.
  // HOW: The PDF is held in memory as a File and only uploaded when Save is
  //      clicked. Photos do not work that way and do not need to: a tile is
  //      itself the commitment, and × removes both the tile and the object.
  const showToast = useToast()
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = pdfFile !== null

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
    if (!hasChanges || saving) return true
    setSaving(true)
    setError(null)
    try {
      const newPdfUrl = pdfFile
        ? await uploadFile('/api/upload/pdf', pdfFile)
        : currentPdfUrl
      await onSave(newPdfUrl)
      showToast('Files saved')
      setPdfFile(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  /* A picked file is not on the server until this runs, so leaving without it
     would silently drop the upload. On failure the step holds, with the error
     above still on screen — the file is only in this component's memory, and
     unmounting is how it would be lost for good. */
  useSaveOnLeave(hasChanges && !saving ? handleSave : null)

  const btnCls = 'btn btn-primary btn-sm'

  return (
    <div className="flex flex-col gap-4 px-5 pb-5">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <div>
        <span className="field-label">Photos</span>
        <PhotoTiles
          idPrefix="guide"
          urls={photoUrls}
          upload={(file) => uploadFile('/api/upload/photo', file)}
          onSave={({ photo_urls }) => onSavePhotos(photo_urls)}
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
      <PanelActions>
        <button
          type="button"
          disabled={!hasChanges || saving}
          onClick={handleSave}
          className={btnCls}
        >
          Save files
        </button>
      </PanelActions>
    </div>
  )
}

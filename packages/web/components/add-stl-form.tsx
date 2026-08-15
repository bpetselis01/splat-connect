'use client'
import { useToast } from '@/components/toast'
import { useState, useTransition } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { FileDropZone } from '@/components/file-drop-zone'

export function AddStlForm({
  tutorialId,
  onAdd,
}: {
  tutorialId: string
  onAdd: (filename: string, fileUrl: string) => Promise<void>
}) {
  const showToast = useToast()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('tutorialId', tutorialId)
      const { url, filename } = await browserApiClient.postFormData<{ url: string; filename: string }>(
        '/api/upload/stl',
        fd
      )
      startTransition(async () => {
        try {
          await onAdd(filename ?? selectedFile.name, url)
          showToast('STL file added')
        } catch (err) {
          // onAdd failed: no toast, no "Last saved" line, and surface the
          // failure through the same error UI as the upload step above,
          // instead of a silently swallowed rejection.
          setError(err instanceof Error ? err.message : 'Failed to save STL file')
        }
      })
      setSelectedFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STL upload failed')
    } finally {
      setUploading(false)
    }
  }

  const btnCls = 'btn btn-primary btn-sm self-end'

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold text-ink">Add STL file</p>
      <label className="field-label" htmlFor="stl_file">STL File</label>
      <FileDropZone id="stl_file" name="stl_file" accept=".stl" label="STL File" onChange={handleChange} />
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!selectedFile || uploading || pending}
          onClick={handleUpload}
          className={btnCls}
        >
          {uploading || pending ? 'Uploading…' : 'Upload STL'}
        </button>
      </div>
    </div>
  )
}

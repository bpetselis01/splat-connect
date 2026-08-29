'use client'
import { PanelActions, useSaveOnLeave } from '@/components/panel-actions'
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
    if (!selectedFile) return true
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
      // Awaited rather than left to the transition: leaving the step depends
      // on whether the record was written, and a transition that resolves
      // after the panel unmounts cannot answer that. startTransition still
      // wraps it so the router refresh it triggers stays non-blocking.
      let added = true
      await new Promise<void>((done) => {
        startTransition(async () => {
          try {
            await onAdd(filename ?? selectedFile.name, url)
            showToast('STL file added')
            setSelectedFile(null)
          } catch (err) {
            // onAdd failed: no toast, no "Last saved" line, and surface the
            // failure through the same error UI as the upload step above,
            // instead of a silently swallowed rejection.
            setError(err instanceof Error ? err.message : 'Failed to save STL file')
            added = false
          }
          done()
        })
      })
      return added
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STL upload failed')
      return false
    } finally {
      setUploading(false)
    }
  }

  /* A chosen file that was never uploaded is the whole step's work, and it
     lives only in this component. STL files are optional, which makes it more
     likely someone picks one and walks on rather than less. */
  useSaveOnLeave(selectedFile && !uploading && !pending ? handleUpload : null)

  const btnCls = 'btn btn-primary btn-sm'

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
      <PanelActions>
        <button
          type="button"
          disabled={!selectedFile || uploading || pending}
          onClick={handleUpload}
          className={btnCls}
        >
          {uploading || pending ? 'Uploading…' : 'Upload STL'}
        </button>
      </PanelActions>
    </div>
  )
}

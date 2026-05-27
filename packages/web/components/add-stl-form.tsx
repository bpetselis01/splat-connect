'use client'
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
        await onAdd(filename ?? selectedFile.name, url)
      })
      setSelectedFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STL upload failed')
    } finally {
      setUploading(false)
    }
  }

  const btnCls =
    'self-end bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#16304f] disabled:opacity-50'

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Add STL file</p>
      <FileDropZone name="stl_file" accept=".stl" label="STL File" onChange={handleChange} />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="button"
        disabled={!selectedFile || uploading || pending}
        onClick={handleUpload}
        className={btnCls}
      >
        {uploading || pending ? 'Uploading…' : 'Upload STL'}
      </button>
    </div>
  )
}

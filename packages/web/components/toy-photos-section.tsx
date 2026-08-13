'use client'
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { FileDropZone } from '@/components/file-drop-zone'
import { useToast } from '@/components/toast'

export function ToyPhotosSection({
  toyId,
  coverPhotoUrl,
  switchAdapted,
  switchPhotoUrls,
  onSave,
  onRemoveSwitchPhoto,
}: {
  toyId: string
  coverPhotoUrl: string | null
  switchAdapted: boolean
  switchPhotoUrls: string[]
  onSave: (fields: {
    cover_photo_url: string | null
    switch_adapted: boolean
    switch_photo_urls: string[]
  }) => Promise<void>
  onRemoveSwitchPhoto: (url: string) => Promise<void>
}) {
  const showToast = useToast()
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [newSwitchFiles, setNewSwitchFiles] = useState<File[]>([])
  const [switchAdaptedInput, setSwitchAdaptedInput] = useState(switchAdapted)
  const [saving, setSaving] = useState(false)
  const [removingUrl, setRemovingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasChanges =
    coverFile !== null || newSwitchFiles.length > 0 || switchAdaptedInput !== switchAdapted

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCoverFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  function handleSwitchFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNewSwitchFiles(e.target.files ? Array.from(e.target.files) : [])
    setError(null)
  }

  async function uploadFile(endpoint: string, file: File): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('toyId', toyId)
    const { url } = await browserApiClient.postFormData<{ url: string }>(endpoint, fd)
    return url
  }

  async function handleSave() {
    if (!hasChanges || saving) return
    setSaving(true)
    setError(null)
    try {
      const newCoverUrl = coverFile
        ? await uploadFile('/api/upload/toy-cover', coverFile)
        : coverPhotoUrl
      const uploadedSwitchUrls = await Promise.all(
        newSwitchFiles.map((f) => uploadFile('/api/upload/toy-switch-photo', f))
      )
      await onSave({
        cover_photo_url: newCoverUrl,
        switch_adapted: switchAdaptedInput,
        switch_photo_urls: [...switchPhotoUrls, ...uploadedSwitchUrls],
      })
      showToast('Photos saved')
      setCoverFile(null)
      setNewSwitchFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(url: string) {
    setRemovingUrl(url)
    setError(null)
    try {
      await onRemoveSwitchPhoto(url)
    } catch {
      setError('Could not remove that photo. Please try again.')
    } finally {
      setRemovingUrl(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-5">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <div>
        <label className="field-label" htmlFor="toy_cover_photo">Cover photo</label>
        <FileDropZone
          id="toy_cover_photo"
          name="toy_cover_photo"
          accept="image/*"
          label="Cover Photo"
          onChange={handleCoverChange}
          currentFileLabel={coverPhotoUrl ? 'Current cover photo on file — upload to replace' : undefined}
        />
      </div>
      <div>
        <label
          htmlFor="toy_switch_adapted"
          className="field-label flex cursor-pointer select-none items-center gap-2"
        >
          <input
            id="toy_switch_adapted"
            type="checkbox"
            className="field-check"
            checked={switchAdaptedInput}
            onChange={(e) => setSwitchAdaptedInput(e.target.checked)}
          />
          Switch-adapted
        </label>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Tick this if the toy has been rewired to work with an accessibility switch. You&rsquo;ll
          need at least one switch photo before you can publish.
        </p>
      </div>
      {switchAdaptedInput && (
        <div className="flex flex-col gap-2">
          <p className="field-label">Switch photos</p>
          {switchPhotoUrls.map((url) => (
            <div key={url} className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted">{url}</span>
              <button
                type="button"
                onClick={() => handleRemove(url)}
                disabled={removingUrl === url}
                className="shrink-0 text-xs font-bold text-danger hover:underline"
              >
                {removingUrl === url ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
          <FileDropZone
            id="toy_switch_photos"
            name="toy_switch_photos"
            accept="image/*"
            multiple
            label="Switch Photos"
            onChange={handleSwitchFilesChange}
          />
        </div>
      )}
      {saving && <p className="text-sm font-semibold text-brand-dark">Saving…</p>}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!hasChanges || saving}
          onClick={handleSave}
          className="btn btn-primary btn-sm self-end"
        >
          Save photos
        </button>
      </div>
    </div>
  )
}

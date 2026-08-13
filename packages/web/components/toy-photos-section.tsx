'use client'
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { FileDropZone } from '@/components/file-drop-zone'
import { ToyPhotoViewer } from '@/components/toy-photo-viewer'
import { useToast } from '@/components/toast'

export function ToyPhotosSection({
  toyId,
  coverPhotoUrl,
  switchAdapted,
  switchPhotoUrls,
  onSave,
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
}) {
  const showToast = useToast()
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [switchFile, setSwitchFile] = useState<File | null>(null)
  const [switchAdaptedInput, setSwitchAdaptedInput] = useState(switchAdapted)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges =
    coverFile !== null || switchFile !== null || switchAdaptedInput !== switchAdapted

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCoverFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  function handleSwitchFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSwitchFile(e.target.files?.[0] ?? null)
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
      // Replaces rather than appends: a toy carries one switch photo, so
      // uploading is also how you remove the wrong one.
      const switchUrls = switchFile
        ? [await uploadFile('/api/upload/toy-switch-photo', switchFile)]
        : switchPhotoUrls
      await onSave({
        cover_photo_url: newCoverUrl,
        switch_adapted: switchAdaptedInput,
        switch_photo_urls: switchUrls,
      })
      showToast('Photos saved')
      setCoverFile(null)
      setSwitchFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
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
          need a switch photo before you can publish.
        </p>
      </div>
      {switchAdaptedInput && (
        <div>
          <label className="field-label" htmlFor="toy_switch_photo">Switch photo</label>
          <FileDropZone
            id="toy_switch_photo"
            name="toy_switch_photo"
            accept="image/*"
            label="Switch Photo"
            onChange={handleSwitchFileChange}
            currentFileLabel={
              switchPhotoUrls.length > 0
                ? 'Current switch photo on file — upload to replace'
                : undefined
            }
          />
        </div>
      )}
      {saving && <p className="text-sm font-semibold text-brand-dark">Saving…</p>}
      {/* Save leads on the left in accent, as it does on Details and Review;
          viewing what is already uploaded is the secondary action, so it sits
          out of the way on the right. */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!hasChanges || saving}
          onClick={handleSave}
          className="btn btn-accent"
        >
          Save photos
        </button>
        <ToyPhotoViewer coverPhotoUrl={coverPhotoUrl} switchPhotoUrls={switchPhotoUrls} />
      </div>
    </div>
  )
}

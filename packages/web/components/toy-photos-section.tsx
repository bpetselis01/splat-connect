'use client'
/**
 * The Photos step of the toy editor. Two dropzones until 053 — a cover and,
 * when the toy was switch-adapted, a switch photo that replaced itself on
 * every upload. Now one box of up to five, with one of them tagged as the
 * photo that shows the switch.
 *
 * Switch-adapted stays a checkbox here and keeps driving the library filter
 * and the card badge. What changed is what proves it: the publish rule reads
 * switch_photo_url rather than counting a separate gallery, so "switch-adapted"
 * and "you can see the switch" are the same claim rather than two.
 */
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { PhotoTiles, type PhotoSave } from '@/components/photo-tiles'
import { PanelActions } from '@/components/panel-actions'

export function ToyPhotosSection({
  toyId,
  photoUrls,
  switchAdapted,
  switchPhotoUrl,
  onSave,
}: {
  toyId: string
  photoUrls: string[]
  switchAdapted: boolean
  switchPhotoUrl: string | null
  onSave: (fields: {
    photo_urls?: string[]
    switch_photo_url?: string | null
    switch_adapted?: boolean
  }) => Promise<void>
}) {
  const [switchAdaptedInput, setSwitchAdaptedInput] = useState(switchAdapted)
  const [saving, setSaving] = useState(false)

  async function uploadPhoto(file: File): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('toyId', toyId)
    const { url } = await browserApiClient.postFormData<{ url: string }>(
      '/api/upload/toy-photo',
      fd
    )
    return url
  }

  async function saveSwitchAdapted() {
    setSaving(true)
    try {
      await onSave({ switch_adapted: switchAdaptedInput })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-5">
      <div>
        <span className="field-label">Photos</span>
        <PhotoTiles
          idPrefix="toy"
          urls={photoUrls}
          switchUrl={switchPhotoUrl}
          upload={uploadPhoto}
          onSave={(next: PhotoSave) => onSave(next)}
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
          need to mark which photo shows the switch before you can publish.
        </p>
      </div>

      {saving && <p className="text-sm font-semibold text-brand-dark">Saving…</p>}
      {/* Photos save as they are added; this button is only for the checkbox
          above it, which is a claim about the toy rather than a file. */}
      <PanelActions>
        <button
          type="button"
          disabled={switchAdaptedInput === switchAdapted || saving}
          onClick={saveSwitchAdapted}
          className="btn btn-accent"
        >
          Save
        </button>
      </PanelActions>
    </div>
  )
}

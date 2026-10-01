'use client'
/**
 * When the author last checked the part prices (086). Its own small form under
 * the parts list: it is a tutorials field, so it saves through PATCH with the
 * concurrency token, unlike the parts list it sits under.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/toast'

export function PricesCheckedField({ value, onSave }: { value: string | null; onSave: (date: string | null) => Promise<void> }) {
  const [date, setDate] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const showToast = useToast()
  return (
    <div className="flex flex-wrap items-end gap-2 px-5 pb-5">
      <label className="flex flex-col gap-1 text-sm font-bold text-ink">
        Prices checked
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
      </label>
      <button
        type="button"
        disabled={saving || date === (value ?? '')}
        onClick={async () => {
          setSaving(true)
          try {
            await onSave(date || null)
            showToast('Prices checked date saved')
            router.refresh()
          } finally {
            setSaving(false)
          }
        }}
        className="btn btn-quiet btn-sm"
      >
        {saving ? 'Saving…' : 'Save date'}
      </button>
    </div>
  )
}

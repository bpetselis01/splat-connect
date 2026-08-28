'use client'
import { useState } from 'react'
import type { BuyLink } from '@splat-connect/types'

interface BuyLinksInputProps {
  initialLinks?: BuyLink[]
  /** Called on every change — used by client-form parents that manage their own state */
  onChange?: (links: BuyLink[]) => void
}

export function BuyLinksInput({ initialLinks = [], onChange }: BuyLinksInputProps) {
  const [links, setLinks] = useState<BuyLink[]>(initialLinks)

  function update(next: BuyLink[]) {
    setLinks(next)
    onChange?.(next)
  }

  function add() {
    update([...links, { label: '', url: '' }])
  }

  function remove(index: number) {
    update(links.filter((_, i) => i !== index))
  }

  function updateField(index: number, field: keyof BuyLink, value: string) {
    update(links.map((link, i) => (i === index ? { ...link, [field]: value } : link)))
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="buy_links" value={JSON.stringify(links)} />
      {links.map((link, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Label (e.g. Jaycar)"
            value={link.label}
            onChange={(e) => updateField(i, 'label', e.target.value)}
            className="field field-sm w-28 shrink-0"
          />
          <input
            type="url"
            placeholder="URL"
            value={link.url}
            onChange={(e) => updateField(i, 'url', e.target.value)}
            className="field field-sm flex-1"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 text-xs font-bold text-danger hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start text-sm font-semibold text-brand-dark hover:underline"
      >
        + Add buy link
      </button>
    </div>
  )
}

/**
 * Buy Links Input Component
 * 
 * Allows users to add where materials/tools can be purchased.
 * Used in the tutorial upload form for parts and tools.
 * 
 * Features:
 * - Add/remove purchase links
 * - Each link has label (e.g., 'Jaycar') and URL
 * - Stored as hidden JSON input for form submission
 * - onChange callback notifies parent of changes
 * 
 * Props:
 * - initialLinks?: Array of existing BuyLink objects
 * - onChange?: Callback when links are modified
 * 
 * Data structure:
 * ```typescript
 * BuyLink = { label: string; url: string }
 * ```
 * 
 * Usage in upload form:
 * - Step 3 (Parts): Add purchase links for each material
 * - Step 4 (Tools): Add purchase links for each tool
 * 
 * Form integration:
 * - Maintains hidden input with JSON-stringified links
 * - Parent form can read input.value to get current links
 * - onChange callback used by parent to update local state
 * 
 * Related files:
 * - app/upload/page.tsx: Uses BuyLinksInput for parts & tools
 * - types/index.ts: BuyLink, Part, Tool types
 */
'use client'
import { useState, useEffect } from 'react'
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

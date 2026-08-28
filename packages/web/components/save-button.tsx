'use client'

/**
 * Keep a thing to come back to.
 *
 * Used two ways. On a card it is an island over the photo: every browse card
 * wraps its whole body in a <Link>, and a <button> inside an <a> is invalid
 * HTML with an ambiguous click target — so the card renders this as a SIBLING
 * of the anchor, never a child. On a detail page it is an ordinary control in
 * the header row, with no positioning at all.
 *
 * Signed-out visitors see it, and clicking sends them to /signup rather than
 * /login: the auth screens carry a segmented switch, so someone who already has
 * an account crosses over in one click, while the reverse assumes an account
 * that most of /library's traffic does not have.
 *
 * Related files:
 * - components/{tutorial,toy-library,challenge}-card.tsx: the opt-in prop
 * - app/globals.css: .save-btn, and the lift that keeps it on its card
 * - lib/saves.ts: where `saved` and `signedIn` come from
 */
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SAVE_SLUGS, type SaveSlug } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { useToast } from '@/components/toast'

export type SaveProps = {
  slug: SaveSlug
  id: string
  saved: boolean
  signedIn: boolean
}

export function SaveButton({
  slug,
  id,
  saved,
  signedIn,
  className = '',
}: SaveProps & { className?: string }) {
  const [on, setOn] = useState(saved)
  const router = useRouter()
  const pathname = usePathname()
  const showToast = useToast()

  async function toggle() {
    if (!signedIn) {
      router.push(`/signup?next=${encodeURIComponent(pathname)}&reason=save`)
      return
    }

    const next = !on
    setOn(next) // Optimistic: the click is the feedback, not the round trip.
    try {
      if (next) {
        // The singular enum value, not the plural slug — the column describes
        // one row. SAVE_SLUGS is the only place that mapping lives.
        await browserApiClient.post('/api/saves', {
          entity_type: SAVE_SLUGS[slug],
          entity_id: id,
        })
      } else {
        await browserApiClient.delete(`/api/saves/${slug}/${id}`)
      }
      // So a saved list drops the card the moment you unsave it. On a browse
      // page this is a no-op the visitor never notices.
      router.refresh()
    } catch {
      setOn(!next)
      showToast(next ? 'Could not save that. Try again.' : 'Could not remove that. Try again.')
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Saved' : 'Save'}
      title={on ? 'Saved' : 'Save'}
      className={`save-btn ${on ? 'is-saved' : ''} ${className}`.trim()}
    >
      <svg viewBox="0 0 12 15" aria-hidden="true" className="h-[15px] w-[12px]">
        <path
          d="M1 1h10v13l-5-4-5 4z"
          fill={on ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

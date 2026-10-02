'use client'
import { useState } from 'react'

/**
 * How many of a client-filtered list to render, a step at a time. The two
 * libraries filter and sort in the browser over every guide or toy, so they
 * cannot be paged on the server; they render `limit` and offer the rest.
 * A different `viewKey` (new filters, search, sort) starts over at one step.
 */
export function useShowMore(viewKey: string, step = 24) {
  const [state, setState] = useState({ key: viewKey, n: step })
  const limit = state.key === viewKey ? state.n : step
  return { limit, more: () => setState({ key: viewKey, n: limit + step }) }
}

export function ShowMoreButton({
  shown,
  total,
  noun,
  onMore,
}: {
  shown: number
  total: number
  noun: string
  onMore: () => void
}) {
  if (shown >= total) return null
  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <button type="button" onClick={onMore} className="btn btn-quiet">
        Show more {noun}
      </button>
      <span className="text-sm font-bold text-muted" aria-live="polite">
        Showing {shown} of {total}
      </span>
    </div>
  )
}

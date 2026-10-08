// packages/mobile/lib/guide-focus.ts
//
// Build mode posts feedback and then closes back onto the guide page already
// mounted beneath it. The guide must open on Feedback with that note in view,
// and router.back() carries no params, so the hand-off lives here: set before
// closing, taken once by the guide's focus effect.
export type GuideFocus = { tutorialId: string; noteId: string | null }

let pending: GuideFocus | null = null

export function setGuideFocus(f: GuideFocus) {
  pending = f
}

/** The focus meant for this guide, cleared on read; null for any other guide. */
export function takeGuideFocus(tutorialId: string): GuideFocus | null {
  if (!pending || pending.tutorialId !== tutorialId) return null
  const f = pending
  pending = null
  return f
}

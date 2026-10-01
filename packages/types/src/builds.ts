/**
 * The pure rules behind build requests and the Makers wanted board, shared by
 * web, mobile and the API (docs/superpowers/specs/2026-10-01-challenges-makers-build-design.md).
 */

/** How soon? on Ask for a build (MB mwnWhen). Stored as the words; the API
 *  still takes any short text, so a request posted with an older list reads
 *  as it was written. */
export const BUILD_URGENCIES = ['No rush', 'This month', 'Before holidays'] as const
export type BuildUrgency = (typeof BUILD_URGENCIES)[number]

/** One message in an Ask first thread (111): the maker's question or the family's answer. */
export interface BuildQuestion {
  id: string
  sender_id: string
  body: string
  created_at: string
}

/** One (request, maker) thread on Ask first. */
export interface BuildQuestionThread {
  maker_id: string
  maker_name: string
  messages: BuildQuestion[]
}

/** GET /api/toy-transactions/:id/questions (makers-ask-first). */
export interface BuildQuestions {
  transaction_id: string
  tutorial_title: string
  requester_suburb: string | null
  /** Unclaimed and still requested: questions can be asked. */
  open: boolean
  /** The caller is the family who asked for the build. */
  family: boolean
  /** The family sees one per maker who asked; a maker sees their own. */
  threads: BuildQuestionThread[]
}

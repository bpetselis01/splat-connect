/**
 * What can this role do with this project, right now.
 *
 * Extracted because the leader's page and the admin's page answer the same
 * question with different authority, and when they each answered it inline they
 * drifted into two holes: the leader's page refused anything not already accepted,
 * so deciding whether to back a project had no home at all; the admin's refused
 * anything not pending, so taking down a bad approval had no home either.
 *
 * Actions are derived, never passed in. A page that can be told what to render is
 * a page that can be told wrong.
 *
 * This decides what to DRAW. The database decides what is permitted — the review
 * grant also checks the organisation is active and the leader has accepted the
 * terms, neither of which these inputs carry. A button drawn here can still be
 * refused, which is correct: the UI mirrors the rule, it does not hold it.
 *
 * Related files:
 * - docs/superpowers/specs/2026-07-28-review-surfaces-design.md §1, §2
 * - supabase/migrations/007_organizations.sql: the grant this mirrors
 */
// The matrices themselves moved to @splat-connect/types when mobile's review
// detail became their second consumer; this module stays as the import path
// web already uses everywhere.
export {
  leaderActions,
  adminActions,
  type LeaderAction,
  type AdminAction,
} from '@splat-connect/types'

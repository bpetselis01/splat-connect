/**
 * The pure rules behind build requests and the Makers wanted board, shared by
 * web, mobile and the API (docs/superpowers/specs/2026-10-01-challenges-makers-build-design.md).
 */

/** How soon? on Ask for a build (MB mwnWhen). Stored as the words; the API
 *  still takes any short text, so a request posted with an older list reads
 *  as it was written. */
export const BUILD_URGENCIES = ['No rush', 'This month', 'Before holidays'] as const
export type BuildUrgency = (typeof BUILD_URGENCIES)[number]

/**
 * The pure rules behind a guide's detail and editors, shared by web, mobile
 * and the API (docs/superpowers/specs/2026-10-01-guides-build-design.md).
 */

/** How a family gets a tool (085), in the board's words. */
export const TOOL_GET_BY_LABEL = { buy: 'Buy once', borrow: 'Borrow', substitute: 'Substitute' } as const
export type ToolGetBy = keyof typeof TOOL_GET_BY_LABEL

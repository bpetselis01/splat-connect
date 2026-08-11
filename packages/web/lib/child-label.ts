/**
 * How a child is identified in the UI.
 *
 * `name` is optional by product decision, so a child without one is identified
 * by position instead. The position is computed from the rendered list rather
 * than stored, which keeps the numbering contiguous after a delete removes a
 * child from the middle — a stored "Child 2" would leave a gap.
 *
 * Related files:
 * - app/dashboard/child/page.tsx: the list
 * - app/dashboard/child/[id]/page.tsx: the edit page heading
 */
export function childLabel(child: { name: string | null }, index: number): string {
  return child.name?.trim() || `Child ${index + 1}`
}

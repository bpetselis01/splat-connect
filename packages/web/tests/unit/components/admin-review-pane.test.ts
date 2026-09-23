import { describe, it, expect, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ apiClient: {} }))

const { completeness } = await import('@/components/admin-review-pane')

const base = {
  kind: 'toy_adaptation' as const,
  photo_urls: ['a.jpg'],
  parts: [{}] as never[],
  tutorial_pdf_url: 'x.pdf',
  stl_files: [] as never[],
  tutorial_collaborator_invites: [],
}
const marks = (t: Parameters<typeof completeness>[0]) =>
  Object.fromEntries(completeness(t).map((c) => [c.label, c.mark]))

describe('completeness', () => {
  it('is all green for a complete toy adaptation, with no STL row at all', () => {
    expect(marks(base)).toEqual({
      'At least one photo': 'ok',
      'Parts listed': 'ok',
      'Guide PDF attached': 'ok',
      'Co-authors confirmed': 'ok',
    })
  })

  it('marks what is missing red, and a pending co-author amber', () => {
    expect(
      marks({
        ...base,
        photo_urls: [],
        parts: [],
        tutorial_pdf_url: null,
        tutorial_collaborator_invites: [{ status: 'pending' }, { status: 'declined' }] as never[],
      })
    ).toEqual({ 'No photo': 'bad', 'No parts listed': 'bad', 'No guide PDF': 'bad', 'Co-authors not confirmed': 'warn' })
  })

  it('checks STL print settings only on assistive tech', () => {
    const at = { ...base, kind: 'assistive_tech' as const }
    expect(marks(at)['No STL files']).toBe('bad')
    expect(
      marks({ ...at, stl_files: [{ material: 'PLA' }, { print_minutes: null }] as never[] })['STL print settings']
    ).toBe('warn')
    expect(marks({ ...at, stl_files: [{ print_minutes: 40 }] as never[] })['STL print settings']).toBe('ok')
  })
})

// A published event as GET /api/public/events/:id returns it.
export const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1', org_id: 'o1', kind: 'build_day', title: 'Switch-adapted toy build day', summary: null,
  starts_at: '2099-10-18T00:00:00Z', ends_at: '2099-10-18T05:30:00Z', format: 'in_person',
  location: 'Northside Community Hall', suburb: 'Northside', state: 'NSW', online_url: null, audience: null, description: 'Build a toy to take home.',
  what_to_bring: null, tools: [], capacity: 20, prints_parts: false, part_sets_max: null, accessibility_note: null,
  cost_cents: null, cost_note: null, photo_urls: [], status: 'published', registrations_closed_at: null, cancelled_at: null,
  created_by: 'u9', created_at: '2099-01-01T00:00:00Z', updated_at: '2099-01-01T00:00:00Z',
  org_name: 'Northside Makers', going_count: 16, seats_left: 4, viewer_going: false, has_questions: false,
  org: { id: 'o1', name: 'Northside Makers', description: null, suburb: 'Northside', state: 'NSW' },
  questions: [], attendee_initials: ['PN', 'TB', 'MK'],
  ...over,
})

export const question = (over: Record<string, unknown> = {}) => ({
  id: 'q1', event_id: 'e1', position: 1, prompt: 'Which session suits you?', answer_type: 'choice', required: false, options: ['Morning', 'Afternoon'],
  ...over,
})

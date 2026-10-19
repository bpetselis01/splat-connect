import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MyReportsPage from '@/app/dashboard/reports/page'
import ThanksNotesPage from '@/app/dashboard/thanks/page'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor', created_at: '', public_showcase: true },
    isAdmin: false,
    ledOrgs: [],
    exchangeActions: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn() } }))

import { apiClient } from '@/lib/api-client'

beforeEach(() => vi.clearAllMocks())

describe('MyReportsPage', () => {
  it('WD28 lists my reports from GET /api/reports with their status and SPLAT’s reply', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      { id: 'r1', subject_label: 'Guide: Ladybug', category: 'safety', status: 'resolved', note_to_reporter: 'We added a cover.', created_at: '2026-10-01T00:00:00Z' },
      { id: 'r2', subject_label: 'Toy: Frog', category: 'safety', status: 'new', note_to_reporter: null, created_at: '2026-10-02T00:00:00Z' },
    ])
    render(await MyReportsPage())
    expect(apiClient.get).toHaveBeenCalledWith('/api/reports')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My reports')
    expect(screen.getByText('Guide: Ladybug')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText(/We added a cover\./)).toBeInTheDocument()
  })
})

describe('ThanksNotesPage', () => {
  it('WD29 lists the notes people left from GET /api/contributors/me/thanks, byline and Hidden tag included', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      { profile_id: 'u1', thanker_id: 'a', note: 'You fixed our switch.', byline: 'Wren', show_note: true, hidden_at: null, transaction_id: null, created_at: '2026-10-01T00:00:00Z' },
      { profile_id: 'u1', thanker_id: 'b', note: 'Thank you for the guide.', byline: null, show_note: false, hidden_at: '2026-10-03T00:00:00Z', transaction_id: null, created_at: '2026-10-02T00:00:00Z' },
      { profile_id: 'u1', thanker_id: 'c', note: null, byline: 'Silent', show_note: false, hidden_at: null, transaction_id: null, created_at: '2026-10-02T00:00:00Z' },
    ])
    render(await ThanksNotesPage())
    expect(apiClient.get).toHaveBeenCalledWith('/api/contributors/me/thanks')
    expect(screen.getByText(/“You fixed our switch\.”|"You fixed our switch\."/)).toBeInTheDocument()
    expect(screen.getByText(/A family · .* · Hidden/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show the note from a family' })).toBeInTheDocument()
    expect(screen.queryByText(/Silent/)).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyReportsList, type MyReport } from '@/components/my-reports-list'

const report = (over: Partial<MyReport> = {}): MyReport => ({
  id: 'r1',
  subject_label: 'Guide: Ladybug',
  category: 'safety',
  status: 'new',
  note_to_reporter: null,
  created_at: '2026-10-01T00:00:00Z',
  ...over,
})

describe('MyReportsList', () => {
  it('shows an empty state when nothing was reported', () => {
    render(<MyReportsList reports={[]} />)
    expect(screen.getByText('No reports yet')).toBeInTheDocument()
  })

  it('shows each report with its status and the note SPLAT sent back', () => {
    render(
      <MyReportsList
        reports={[report({ status: 'resolved', note_to_reporter: 'We added a screw-down cover.' }), report({ id: 'r2', subject_label: 'Toy: Frog', status: 'looking' })]}
      />
    )
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('Being looked at')).toBeInTheDocument()
    expect(screen.getByText(/We added a screw-down cover\./)).toBeInTheDocument()
    expect(screen.getAllByText(/Safety concern/)).toHaveLength(2)
  })
})

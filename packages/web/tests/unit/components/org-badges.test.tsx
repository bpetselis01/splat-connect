import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrgBadges } from '@/components/org-badges'
import type { TutorialOrg } from '@splat-connect/types'

const row = (name: string, status: 'pending' | 'accepted' | 'declined'): TutorialOrg => ({
  id: name,
  tutorial_id: 't',
  org_id: name,
  status,
  requested_at: '',
  responded_at: null,
  responded_by: null,
  organizations: {
    id: name, name, description: null, status: 'active',
    created_by: null, created_at: '', updated_at: '',
  },
})

describe('OrgBadges', () => {
  // Tests: only accepted backing renders; pending and declined never do
  // How:   passes one of each status; checks the two non-accepted names are absent
  // Chain: an organisation's mark appears only where one of its leaders put it —
  //        showing a pending request would claim an endorsement nobody gave
  it('shows accepted orgs and hides pending and declined ones', () => {
    render(
      <OrgBadges
        backing={[row('Riverside', 'accepted'), row('Northside', 'pending'), row('Declining', 'declined')]}
      />
    )
    expect(screen.getByText(/Riverside/)).toBeInTheDocument()
    expect(screen.queryByText(/Northside/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Declining/)).not.toBeInTheDocument()
  })

  // Tests: the approver line names the person and the org whose authority they used
  // How:   passes approvedByName and approvedForOrgName; checks the combined line
  // Chain: several orgs may back one project but only one approved it, so the page
  //        must not let the badge list imply who did the reviewing
  it('names the approver and the org whose authority they used', () => {
    render(
      <OrgBadges
        backing={[row('Riverside', 'accepted'), row('Northside', 'accepted')]}
        approvedByName="Sam"
        approvedForOrgName="Riverside"
      />
    )
    expect(screen.getByText('Approved by Sam, Riverside')).toBeInTheDocument()
  })

  // Tests: nothing renders when there is nothing to say
  // How:   passes only a pending row and no approver; checks the container is empty
  // Chain: an unbacked tutorial gets no empty box on the public page
  it('renders nothing when there is nothing to say', () => {
    const { container } = render(<OrgBadges backing={[row('Northside', 'pending')]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

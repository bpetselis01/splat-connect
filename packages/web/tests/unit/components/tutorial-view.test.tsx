import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { browserApiClient } from '@/lib/browser-api-client'
import { TutorialView } from '@/components/tutorial-view'
import type { TutorialWithDetails, Recommendation } from '@splat-connect/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next/navigation', () => ({ usePathname: () => '/tutorials/t1', useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn().mockResolvedValue({}) } }))

const stl = [{ id: 's1', tutorial_id: 't1', filename: 'bracket.stl', file_url: 't1/bracket.stl' }]

function rec(id: string, position: number, status: Recommendation['tutorials']['status'] = 'approved'): Recommendation {
  return {
    position,
    tutorials: { id, title: `Rec ${id}`, kind: 'assistive_tech', difficulty: 'easy', toy_photo_url: null, status },
  }
}

function tutorial(overrides: Partial<TutorialWithDetails> = {}): TutorialWithDetails {
  return {
    id: 't1',
    title: 'Bubble Machine',
    description: null,
    difficulty: 'easy',
    kind: 'toy_adaptation',
    status: 'approved',
    safety_declared_at: null,
    build_minutes: 30,
    tutorial_pdf_url: null,
    photo_urls: [],
    toy_photo_url: null,
    rejection_note: null,
    created_at: '',
    updated_at: '',
    reviewed_at: null,
    reviewed_by: null,
    reviewed_for_org_id: null,
    parts: [],
    tools: [],
    stl_files: [],
    tutorial_recommendations: [],
    tutorial_contributors: [],
    ...overrides,
  }
}

describe('TutorialView', () => {
  // Files follow the data, not the kind: STL rows or any print setting show the tab.
  it('shows the Files tab for any guide with STL files or a print setting, and not otherwise', () => {
    const { unmount } = render(<TutorialView tutorial={tutorial({ stl_files: stl })} signedIn={false} />)
    expect(screen.getByText('bracket.stl')).toBeInTheDocument()
    unmount()
    const { unmount: u2 } = render(<TutorialView tutorial={tutorial({ material: 'PETG' })} signedIn={false} />)
    expect(screen.getByText('PETG')).toBeInTheDocument()
    u2()
    render(<TutorialView tutorial={tutorial()} signedIn={false} />)
    expect(screen.queryByText('Layer height')).toBeNull()
    expect(screen.queryByText('Request a print →')).toBeNull()
  })

  // 080: numbered steps first, and the fit line above the tabs only when given.
  it('numbers the steps in a Steps tab and draws the fit callout only when there is one', () => {
    const steps = [
      { id: 'a', tutorial_id: 't1', position: 1, title: 'Open it', body: 'Unscrew the lid.', photo_url: null },
      { id: 'b', tutorial_id: 't1', position: 2, title: null, body: 'Fit the interrupter.', photo_url: null },
    ]
    const { unmount } = render(
      <TutorialView tutorial={tutorial({ steps })} signedIn fit="Suits your child" />
    )
    expect(screen.getByText('Open it')).toBeInTheDocument()
    expect(screen.getByText('Fit the interrupter.')).toBeInTheDocument()
    expect(screen.getByTestId('fit-callout')).toHaveTextContent('Suits your child')
    unmount()
    render(<TutorialView tutorial={tutorial({ steps })} signedIn />)
    expect(screen.queryByTestId('fit-callout')).toBeNull()
  })

  it('shows each step\'s tip and minutes, and the author\'s closing line after the last step', () => {
    const steps = [
      { id: 'a', tutorial_id: 't1', position: 1, title: 'Open it', body: 'Unscrew.', photo_url: null, tip: 'Keep the screws', minutes: 10 },
      { id: 'b', tutorial_id: 't1', position: 2, title: null, body: 'Close.', photo_url: null },
    ]
    const { unmount } = render(<TutorialView tutorial={tutorial({ steps, done_note: 'Enjoy!' })} signedIn />)
    expect(screen.getByTestId('step-tip')).toHaveTextContent('Keep the screws')
    expect(screen.getByText('~10 min')).toBeInTheDocument()
    expect(screen.getByTestId('done-note')).toHaveTextContent('Enjoy!')
    unmount()
    render(<TutorialView tutorial={tutorial({ steps })} signedIn />)
    expect(screen.queryByTestId('done-note')).toBeNull()
  })

  it('pills a required recommendation', () => {
    render(<TutorialView tutorial={tutorial({ tutorial_recommendations: [{ ...rec('a', 1), required: true }, rec('b', 2)] })} signedIn={false} />)
    expect(screen.getAllByText('Required first')).toHaveLength(1)
  })

  it('names the kind in the header', () => {
    render(<TutorialView tutorial={tutorial({ kind: 'assistive_tech' })} signedIn={false} />)
    expect(screen.getByText('Assistive tech')).toBeInTheDocument()
  })

  it('lists recommendations as cards in position order', () => {
    render(<TutorialView tutorial={tutorial({ tutorial_recommendations: [rec('a', 1), rec('b', 2), rec('c', 3)] })} signedIn={false} />)
    expect(screen.getByText('Also worth a look')).toBeInTheDocument()
    const hrefs = screen.getAllByTestId('rec-card').map((el) => el.getAttribute('href'))
    expect(hrefs).toEqual(['/tutorials/a', '/tutorials/b', '/tutorials/c'])
    expect(screen.queryByText(/Not yet approved/)).toBeNull()
  })

  // Only the review pages ever hand this an unapproved target; the public
  // route has dropped them before the component sees the tutorial.
  it('tags an unapproved recommendation for a reviewer', () => {
    render(<TutorialView tutorial={tutorial({ tutorial_recommendations: [rec('a', 1, 'pending')] })} signedIn={false} />)
    expect(screen.getByText(/Not yet approved/)).toBeInTheDocument()
  })

  it('WT06 the rail leads to the build-help form and the toy library, and the Files tab to a print request, all for this guide', () => {
    render(<TutorialView tutorial={tutorial({ kind: 'assistive_tech', stl_files: stl, tutorial_recommendations: [rec('a', 1)] })} signedIn={false} />)
    expect(screen.getByRole('link', { name: 'Get help with this build' })).toHaveAttribute('href', '/get-involved/requests/new?guide=t1')
    expect(screen.getByRole('link', { name: 'Toy library →' })).toHaveAttribute('href', '/toy-library')
    expect(screen.getByRole('link', { name: 'Request a print →' })).toHaveAttribute('href', '/printing/requests?guide=t1')
    expect(screen.getByTestId('rec-card')).toHaveAttribute('href', '/tutorials/a')
  })

  it('draws no section when there are no recommendations', () => {
    render(<TutorialView tutorial={tutorial()} signedIn={false} />)
    expect(screen.queryByText('Also worth a look')).toBeNull()
  })

  const files = { kind: 'assistive_tech' as const, tutorial_pdf_url: 't1/tutorial.pdf', stl_files: stl }

  // The link is the gate the visitor sees. Same <a>, a different destination
  // — no client JavaScript, the way save-button.tsx sends a signed-out saver
  // to signup.
  it('WT04 WT05 sends a signed-out visitor to sign up from the PDF and each STL', () => {
    render(<TutorialView tutorial={tutorial(files)} signedIn={false} />)
    const detour = '/signup?next=%2Ftutorials%2Ft1&reason=download'
    expect(screen.getByRole('link', { name: 'Sign in to download' })).toHaveAttribute('href', detour)
    expect(screen.getByRole('link', { name: 'Download bracket.stl' })).toHaveAttribute('href', detour)
    expect(screen.getByRole('link', { name: 'Sign in to download' })).not.toHaveAttribute('target')
  })

  it('WT04 WT05 links a signed-in visitor through /files, which signs on click', () => {
    render(<TutorialView tutorial={tutorial(files)} signedIn />)
    expect(screen.getByRole('link', { name: 'Download guide (PDF)' })).toHaveAttribute(
      'href',
      '/files/tutorial-pdfs/t1/tutorial.pdf'
    )
    expect(screen.getByRole('link', { name: 'Download guide (PDF)' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'Download bracket.stl' })).toHaveAttribute('href', '/files/stl-files/t1/bracket.stl')
    expect(screen.getByRole('link', { name: 'Download bracket.stl' })).not.toHaveAttribute('target')
  })

  // Parts sourcing is open in both states: it is someone else's shop, and a
  // parent pricing a build should not need an account to do it.
  it('WT03 leaves buy links open either way, each in a new tab', () => {
    const parts = [{ id: 'p1', tutorial_id: 't1', name: 'Switch', quantity: 1, is_optional: false, buy_links: [{ label: 'Jaycar', url: 'https://shop.test/switch' }] }]
    render(<TutorialView tutorial={tutorial({ parts })} signedIn={false} />)
    const buy = screen.getByRole('link', { name: 'Buy Switch from Jaycar' })
    expect(buy).toHaveAttribute('href', 'https://shop.test/switch')
    expect(buy).toHaveAttribute('target', '_blank')
    expect(buy).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('never makes a buy link that is not a web address', () => {
    const parts = [{ id: 'p1', tutorial_id: 't1', name: 'Switch', quantity: 1, is_optional: false, buy_links: [{ label: 'Evil', url: 'javascript:alert(1)' }, { label: 'Jaycar', url: 'https://shop.test/switch' }] }]
    render(<TutorialView tutorial={tutorial({ parts })} signedIn={false} />)
    expect(screen.queryByRole('link', { name: 'Buy Switch from Evil' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Buy Switch from Jaycar' })).toBeTruthy()
  })

  it('shows each tool’s note and how to get it', () => {
    render(
      <TutorialView
        signedIn
        tutorial={tutorial({ tools: [{ id: 'x', tutorial_id: 't1', name: 'Hot glue gun', is_optional: false, buy_links: [], note: 'Anchoring the jack', get_by: 'borrow' }] })}
      />
    )
    expect(screen.getByText('Anchoring the jack')).toBeInTheDocument()
    expect(screen.getByText('Borrow')).toBeInTheDocument()
  })
})

describe('TutorialView tabs', () => {
  const parts = [{ id: 'p1', tutorial_id: 't1', name: 'Switch', quantity: 1, is_optional: false, buy_links: [] }]

  // Only the sections the data can fill get a tab; the board's Steps and
  // Community notes have nothing behind them in this schema.
  it('WT02 draws a tab per filled section and keeps the rest in the DOM', () => {
    render(
      <TutorialView
        tutorial={tutorial({ kind: 'assistive_tech', parts, stl_files: stl, safety_declared_at: '2026-08-01T00:00:00Z' })}
        signedIn
      />
    )
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Parts & tools',
      'Files & print settings',
      'Safety',
    ])
    expect(screen.getByText('bracket.stl').closest('[role="tabpanel"]')).toHaveAttribute('hidden')
  })

  it('draws no strip for a single section', () => {
    render(<TutorialView tutorial={tutorial({ parts })} signedIn={false} />)
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByText('Switch')).toBeVisible()
  })
})

describe('print settings', () => {
  it('lists the guide’s print settings on the Files tab', () => {
    // A second section, or the tab strip is not drawn.
    const parts = [{ id: 'p1', tutorial_id: 't1', name: 'Switch', quantity: 1, is_optional: false, buy_links: [] }]
    render(
      <TutorialView
        signedIn
        tutorial={tutorial({ kind: 'assistive_tech', parts, stl_files: stl, layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 190 })}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Files & print settings' }))
    expect(screen.getByText('Layer height')).toBeInTheDocument()
    expect(screen.getByText('3 h 10')).toBeInTheDocument()
  })
})

describe('safety notes', () => {
  it('lists the author’s safety notes under the checklist', () => {
    // A second section, or the tab strip is not drawn.
    const parts = [{ id: 'p1', tutorial_id: 't1', name: 'Switch', quantity: 1, is_optional: false, buy_links: [] }]
    render(
      <TutorialView
        signedIn
        tutorial={tutorial({ parts, safety_declared_at: '2026-09-01T00:00:00Z', safety_notes: [{ id: 'n', tutorial_id: 't1', position: 1, title: 'Battery door must be screwed shut', detail: 'Add the screw.' }] })}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Safety' }))
    expect(screen.getByText('Battery door must be screwed shut')).toBeInTheDocument()
    expect(screen.getByText('Add the screw.')).toBeInTheDocument()
  })
})

describe('community notes', () => {
  it('WT12 warns of pinned revisions and lists them, read only', () => {
    const pinned = { id: 'n', step_position: 2, author_id: 'p', author_name: 'Priya', body: 'Use two zip ties.', photo_url: null, photo_caption: null, pinned_at: '2026-09-02T00:00:00Z', pinned_by: 'a', pinned_by_name: 'Sam', created_at: '2026-09-01T00:00:00Z' }
    render(<TutorialView signedIn tutorial={tutorial()} notes={[pinned, { ...pinned, id: 'o', pinned_at: null }]} />)
    expect(screen.getByText(/1 pinned revision/)).toBeInTheDocument()
    expect(screen.getByText(/since this was written — read before you build\./)).toBeInTheDocument()
    expect(screen.getByText('Use two zip ties.')).toBeInTheDocument()
    expect(screen.getAllByText('Use two zip ties.')).toHaveLength(1)
  })
})

describe('who it is for', () => {
  it('labels device types and the four tags, with one hand beside access, and hides empty groups', () => {
    render(
      <TutorialView
        signedIn
        tutorial={tutorial({ device_types: ['adapted_toy'], helps_with: ['communicating'], access: ['press'], one_hand: true, press_force: ['light'], play: null } as never)}
      />
    )
    const block = screen.getByRole('region', { name: "Who it's for" })
    expect(block).toHaveTextContent('Device type')
    expect(block).toHaveTextContent('Adapted toy')
    expect(block).toHaveTextContent('Helps with')
    expect(block).toHaveTextContent('One hand is enough')
    expect(block).toHaveTextContent('Press force')
    expect(block).not.toHaveTextContent('Play')
  })

  it('draws nothing when no tag is set', () => {
    render(<TutorialView signedIn tutorial={tutorial()} />)
    expect(screen.queryByRole('region', { name: "Who it's for" })).toBeNull()
  })
})

describe('photo captions', () => {
  it('shows the caption under a photo', () => {
    render(<TutorialView signedIn tutorial={tutorial({ photo_urls: ['https://test.supabase.co/storage/v1/object/public/photos/a.jpg'], photo_captions: ['The finished bracket'] })} />)
    expect(screen.getByText('The finished bracket')).toBeInTheDocument()
  })
})

describe('pinning community notes', () => {
  const note = { id: 'n', step_position: 2, author_id: 'p', author_name: 'Priya', body: 'Use two zip ties.', photo_url: null, photo_caption: null, pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z' }
  const pinnedNote = { ...note, id: 'q', body: 'Mind the lid.', pinned_at: '2026-09-02T00:00:00Z', pinned_by: 'a', pinned_by_name: 'Sam' }

  it('shows no controls to anyone but the author or an admin', () => {
    render(<TutorialView signedIn tutorial={tutorial()} notes={[note, pinnedNote]} />)
    expect(screen.queryByRole('button', { name: /pin/i })).toBeNull()
    expect(screen.queryByText('Use two zip ties.')).toBeNull()
  })

  it('WT11 pins an unpinned note and unpins a pinned one through the api', async () => {
    render(<TutorialView signedIn canPin tutorial={tutorial()} notes={[note, pinnedNote]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pin as revision' }))
    await waitFor(() => expect(browserApiClient.post).toHaveBeenCalledWith('/api/tutorials/t1/notes/n/pin', {}))
    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }))
    await waitFor(() => expect(browserApiClient.post).toHaveBeenCalledWith('/api/tutorials/t1/notes/q/unpin', {}))
  })

  it('labels a note on a guide with no steps "Whole guide"', () => {
    render(<TutorialView signedIn canPin tutorial={tutorial({ steps: [] })} notes={[{ ...note, step_position: null }]} />)
    expect(screen.getByText(/Whole guide · Priya/)).toBeInTheDocument()
    expect(screen.queryByText(/Missing step/)).toBeNull()
  })
})

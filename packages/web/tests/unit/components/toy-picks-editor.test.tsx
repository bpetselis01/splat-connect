import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToyPicksEditor } from '@/components/toy-picks-editor'
import type { Toy } from '@splat-connect/types'

vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn(), put: vi.fn() } }))
import { browserApiClient } from '@/lib/browser-api-client'

const toy = (over: Partial<Toy> = {}): Toy => ({
  id: 't1', owner_id: 'u1', owner_org_id: null, quantity: 1, name: 'Fire truck', description: null, condition: 8,
  switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
  offer_type: 'donation', created_at: '', updated_at: '', ...over,
})

describe('ToyPicksEditor', () => {
  beforeEach(() => {
    vi.mocked(browserApiClient.put).mockReset()
    vi.mocked(browserApiClient.patch).mockReset()
  })

  it('WY23 saves the hand-picked toys and guides in the order chosen', async () => {
    vi.mocked(browserApiClient.put).mockResolvedValue({ picks: [] })
    const onSaved = vi.fn()
    render(
      <ToyPicksEditor
        toy={toy({ picks_mode: 'picked', toy_picks: [] })}
        ownToys={[toy({ id: 't2', name: 'Robot' }), toy({ id: 't3', name: 'Draft one', status: 'draft' })]}
        guides={[{ id: 'g1', title: 'Switch mount' }]}
        onSaved={onSaved}
      />
    )
    expect(screen.queryByLabelText('Draft one')).toBeNull()
    fireEvent.click(screen.getByLabelText('Switch mount'))
    fireEvent.click(screen.getByLabelText('Robot'))
    fireEvent.click(screen.getByRole('button', { name: 'Save picks' }))
    await vi.waitFor(() =>
      expect(browserApiClient.put).toHaveBeenCalledWith('/api/toys/t1/picks', {
        picks: [{ entity_type: 'tutorial', entity_id: 'g1' }, { entity_type: 'toy', entity_id: 't2' }],
      })
    )
    await vi.waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          toy_picks: [
            { position: 1, entity_type: 'tutorial', entity_id: 'g1' },
            { position: 2, entity_type: 'toy', entity_id: 't2' },
          ],
        })
      )
    )
  })

  it('WY23 switches back to automatic', async () => {
    const onSaved = vi.fn()
    vi.mocked(browserApiClient.patch).mockResolvedValue(toy({ picks_mode: 'auto' }))
    render(<ToyPicksEditor toy={toy({ picks_mode: 'picked' })} ownToys={[]} guides={[]} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Automatic' }))
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ picks_mode: 'auto' })))
    expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1', { picks_mode: 'auto' })
  })

  it('holds Save picks and the mode radios while a save is in flight', async () => {
    let finish: (v: unknown) => void = () => {}
    vi.mocked(browserApiClient.put).mockReturnValue(new Promise((r) => (finish = r)))
    render(<ToyPicksEditor toy={toy({ picks_mode: 'picked', toy_picks: [] })} ownToys={[]} guides={[]} onSaved={vi.fn()} />)
    const save = screen.getByRole('button', { name: 'Save picks' })
    fireEvent.click(save)
    fireEvent.click(save)
    expect(browserApiClient.put).toHaveBeenCalledTimes(1)
    expect(save).toHaveProperty('disabled', true)
    expect(screen.getByRole('radio', { name: 'Automatic' })).toHaveProperty('disabled', true)
    finish({ picks: [] })
    await vi.waitFor(() => expect(save).toHaveProperty('disabled', false))
  })

  it('sends nothing when the mode tapped is the mode already set', () => {
    render(<ToyPicksEditor toy={toy({ picks_mode: 'picked' })} ownToys={[]} guides={[]} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Hand-picked' }))
    expect(browserApiClient.patch).not.toHaveBeenCalled()
  })
})

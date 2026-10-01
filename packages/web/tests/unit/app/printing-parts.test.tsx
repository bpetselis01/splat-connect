import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrintingPartsPage from '@/app/printing/parts/page'

const get = vi.hoisted(() => vi.fn())
const saved = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
vi.mock('@/lib/saves', () => ({ getSavedIds: async () => saved.current }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/printing/parts' }))
vi.mock('@/components/toast', () => ({ useToast: () => vi.fn() }))

describe('/printing/parts', () => {
  beforeEach(() => {
    saved.current = null
  })

  it('lists parts with their guide, material, grams and time, and keeps the board’s steps', async () => {
    get.mockResolvedValue({
      items: [{ id: 'f1', filename: 'cradle-65mm.stl', material: 'PETG', filament_grams: 12, print_minutes: 45, tutorial_id: 'g1', tutorials: { id: 'g1', title: 'Switch mount', status: 'approved' } }],
      page: 1, pages: 1, total: 1,
    })
    render(await PrintingPartsPage({ searchParams: Promise.resolve({ q: 'cradle' }) }))
    expect(get).toHaveBeenCalledWith('/api/public/printable-parts?q=cradle')
    expect(screen.getByText('cradle-65mm.stl')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch mount' })).toHaveAttribute('href', '/tutorials/g1')
    expect(screen.getByText('PETG · 12 g · 45 min')).toBeInTheDocument()
    expect(screen.getByText('Check the tested filament and settings before you print')).toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    get.mockResolvedValue({ items: [], page: 1, pages: 1, total: 0 })
    render(await PrintingPartsPage({ searchParams: Promise.resolve({ q: 'zzz' }) }))
    expect(screen.getByText('Nothing matches "zzz". Try a different word, or clear the search.')).toBeInTheDocument()
  })

  it('puts a filled save control on a part already saved', async () => {
    get.mockResolvedValue({
      items: [{ id: 'f1', filename: 'cradle-65mm.stl', material: null, filament_grams: null, print_minutes: null, tutorial_id: 'g1', tutorials: { id: 'g1', title: 'Switch mount', status: 'approved' } }],
      page: 1, pages: 1, total: 1,
    })
    saved.current = { tutorials: [], toys: [], challenges: [], organisations: [], parts: ['f1'] }
    render(await PrintingPartsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')
  })
})

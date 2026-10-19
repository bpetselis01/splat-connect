import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShareButton } from '@/components/share-button'

const showToast = vi.fn()
vi.mock('@/components/toast', () => ({ useToast: () => showToast }))

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('ShareButton', () => {
  it('WT07 copies the page address and says "Link copied" where there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ShareButton title="Bubble Machine" />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href))
    expect(showToast).toHaveBeenCalledWith('Link copied')
  })

  it('WT07 opens the platform share sheet with the title and address where there is one, and copies nothing', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    Object.assign(navigator, { share, clipboard: { writeText } })
    render(<ShareButton title="Bubble Machine" />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Bubble Machine', url: window.location.href }))
    expect(writeText).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('stays quiet when the share sheet is dismissed', async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError')) })
    render(<ShareButton title="Bubble Machine" />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(navigator.share).toHaveBeenCalled())
    expect(showToast).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MarkBuildDoneButton } from '@/components/mark-build-done-button'

const mockPost = vi.fn().mockResolvedValue({ built: true })
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => mockPost(...a) } }))
const mockToast = vi.fn()
vi.mock('@/components/toast', () => ({ useToast: () => mockToast }))

describe('MarkBuildDoneButton', () => {
  it('logs the build and says so', async () => {
    render(<MarkBuildDoneButton tutorialId="t1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark this build done' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/build', {}))
    expect(mockToast).toHaveBeenCalledWith('Build logged — nice work')
    expect(screen.getByRole('button', { name: 'Build logged' })).toBeDisabled()
  })
})

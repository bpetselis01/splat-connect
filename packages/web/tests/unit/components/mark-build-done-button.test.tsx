import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MarkBuildDoneButton } from '@/components/mark-build-done-button'

const mockPost = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

describe('MarkBuildDoneButton', () => {
  it('WT10 logs the build and says so', async () => {
    mockPost.mockResolvedValueOnce({ built: true })
    render(<MarkBuildDoneButton tutorialId="t1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark this build done' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/build', {}))
    expect(await screen.findByRole('status')).toHaveTextContent('Build logged — nice work')
    expect(screen.getByRole('button', { name: 'Build logged' })).toBeDisabled()
  })

  it('says so when logging fails, and lets the member try again', async () => {
    mockPost.mockRejectedValueOnce(new Error('boom'))
    render(<MarkBuildDoneButton tutorialId="t1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark this build done' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not log that. Try again.')
    expect(screen.getByRole('button', { name: 'Mark this build done' })).toBeEnabled()
  })
})

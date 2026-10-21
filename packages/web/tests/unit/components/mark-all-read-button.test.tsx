import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarkAllReadButton } from '@/components/mark-all-read-button'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const click = () => fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))

describe('MarkAllReadButton', () => {
  it('shows no alert when every row was marked', async () => {
    const action = vi.fn().mockResolvedValue(0)
    render(<MarkAllReadButton action={action} />)
    click()
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports a partial failure with the count', async () => {
    render(<MarkAllReadButton action={vi.fn().mockResolvedValue(2)} />)
    click()
    expect((await screen.findByRole('alert')).textContent).toBe('2 notifications could not be marked read. Try again.')
  })

  it('reports a total failure when the action throws', async () => {
    render(<MarkAllReadButton action={vi.fn().mockRejectedValue(new Error('x'))} />)
    click()
    expect((await screen.findByRole('alert')).textContent).toBe('Could not mark your notifications read. Try again.')
  })
})

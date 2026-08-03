import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/toast'

function Trigger({ message }: { message: string }) {
  const showToast = useToast()
  return (
    <button type="button" onClick={() => showToast(message)}>
      Trigger
    </button>
  )
}

describe('ToastProvider / useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the message after showToast is called', () => {
    render(
      <ToastProvider>
        <Trigger message="Details saved" />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.getByRole('status')).toHaveTextContent('Details saved')
  })

  it('clears the message on its own after a few seconds', () => {
    render(
      <ToastProvider>
        <Trigger message="Details saved" />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Trigger'))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('useToast is a safe no-op outside a provider', () => {
    render(<Trigger message="hi" />)
    expect(() => fireEvent.click(screen.getByText('Trigger'))).not.toThrow()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

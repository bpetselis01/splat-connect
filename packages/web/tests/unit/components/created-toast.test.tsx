import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CreatedToast } from '@/components/created-toast'
import { ToastProvider } from '@/components/toast'

const replace = vi.fn()
let searchParamsValue = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/tutorials/t1/edit',
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

describe('CreatedToast', () => {
  beforeEach(() => {
    replace.mockClear()
    searchParamsValue = ''
  })

  // Tests: arriving from /upload announces that the tutorial was created
  // How:   renders with created=1 in the query and waits for the live region
  // Chain: /upload and the editor draw the same pills and the same panel, so
  //        the redirect between them changed almost nothing on screen. A correct
  //        redirect that announces nothing reads as being thrown somewhere else
  it('announces the create when it arrives from the new-tutorial form', async () => {
    searchParamsValue = 'step=details&created=1'
    render(
      <ToastProvider>
        <CreatedToast />
      </ToastProvider>
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Tutorial created')
    // And drops the flag, so a refresh does not announce it twice — keeping the
    // step it arrived on.
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/tutorials/t1/edit?step=details', { scroll: false })
    )
  })

  // Chain: the editor is reached directly far more often than it is redirected
  //        to, and an announcement for something that did not just happen is
  //        worse than none
  it('says nothing and rewrites nothing without the flag', () => {
    searchParamsValue = 'step=details'
    render(
      <ToastProvider>
        <CreatedToast />
      </ToastProvider>
    )
    expect(screen.queryByRole('status')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })
})

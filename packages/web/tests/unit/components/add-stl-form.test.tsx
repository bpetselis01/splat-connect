import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddStlForm } from '@/components/add-stl-form'
import { ToastProvider } from '@/components/toast'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { postFormData: vi.fn() },
}))

const mockPostFormData = vi.mocked(browserApiClient.postFormData)

describe('AddStlForm save feedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('WT27 uploads the chosen STL for this guide, then records it under its own name and storage path', async () => {
    mockPostFormData.mockResolvedValue({ url: 'tid-1/model.stl', filename: 'model.stl' })
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <AddStlForm tutorialId="tid-1" onAdd={onAdd} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText(/stl file/i, { selector: 'input' }), {
      target: { files: [new File(['stl'], 'model.stl', { type: 'application/octet-stream' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /upload stl/i }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('model.stl', 'tid-1/model.stl'))
    expect(mockPostFormData).toHaveBeenCalledWith('/api/upload/stl', expect.any(FormData))
    expect((mockPostFormData.mock.calls[0][1] as FormData).get('tutorialId')).toBe('tid-1')
  })

  it('fires the shared toast with "STL file added" after a successful upload', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/model.stl', filename: 'model.stl' })
    render(
      <ToastProvider>
        <AddStlForm tutorialId="tid-1" onAdd={vi.fn().mockResolvedValue(undefined)} />
      </ToastProvider>
    )
    const fileInput = screen.getByLabelText(/stl file/i, { selector: 'input' })
    fireEvent.change(fileInput, {
      target: { files: [new File(['stl'], 'model.stl', { type: 'application/octet-stream' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /upload stl/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('STL file added'))
  })

  it('does not show a toast when the upload fails', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/model.stl', filename: 'model.stl' })
    const onAdd = vi.fn().mockRejectedValue(new Error('boom'))
    render(
      <ToastProvider>
        <AddStlForm tutorialId="tid-1" onAdd={onAdd} />
      </ToastProvider>
    )
    const fileInput = screen.getByLabelText(/stl file/i, { selector: 'input' })
    fireEvent.change(fileInput, {
      target: { files: [new File(['stl'], 'model.stl', { type: 'application/octet-stream' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /upload stl/i }))
    await waitFor(() => expect(onAdd).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

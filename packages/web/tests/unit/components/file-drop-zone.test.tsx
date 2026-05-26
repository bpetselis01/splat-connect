import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FileDropZone } from '@/components/file-drop-zone'

describe('FileDropZone', () => {
  it('renders label text in the drop prompt', () => {
    render(<FileDropZone name="file" label="Upload PDF" accept=".pdf" onChange={() => {}} />)
    expect(screen.getByText(/upload pdf/i)).toBeInTheDocument()
  })

  it('calls onChange when file is selected', () => {
    const handleChange = vi.fn()
    render(<FileDropZone name="file" label="Upload PDF" accept=".pdf" onChange={handleChange} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'tutorial.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(handleChange).toHaveBeenCalled()
  })

  it('shows selected filename after selection', () => {
    render(<FileDropZone name="file" label="Upload PDF" accept=".pdf" onChange={() => {}} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'tutorial.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(screen.getByText('tutorial.pdf')).toBeInTheDocument()
  })
})

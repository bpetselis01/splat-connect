import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FileDropZone } from '@/components/file-drop-zone'

describe('FileDropZone', () => {
  // Tests: FileDropZone shows the label text passed via the label prop
  // How:   renders with label="Upload PDF"; checks text 'Upload PDF' is in the document
  // Chain: the label tells the user what file type to drop → upload wizard steps use
  //        different labels ('Upload PDF', 'Upload photo') to guide the user
  it('renders label text in the drop prompt', () => {
    render(<FileDropZone name="file" label="Upload PDF" accept=".pdf" onChange={() => {}} />)
    expect(screen.getByText(/upload pdf/i)).toBeInTheDocument()
  })

  // Tests: selecting a file via the hidden file input triggers the onChange callback
  // How:   fires a change event on the file input with a fake PDF file; checks onChange was called
  // Chain: the upload wizard receives the File object in onChange → it calls postFormData to
  //        upload the file to Supabase storage and get back a public URL
  it('calls onChange when file is selected', () => {
    const handleChange = vi.fn()
    render(<FileDropZone name="file" label="Upload PDF" accept=".pdf" onChange={handleChange} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'tutorial.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(handleChange).toHaveBeenCalled()
  })

  // Tests: after a file is selected, its name is displayed in the drop zone
  // How:   fires a change event with 'tutorial.pdf'; checks text 'tutorial.pdf' is in the document
  // Chain: the user can confirm which file they selected before clicking Next → reduces errors
  //        from accidentally selecting the wrong file
  it('shows selected filename after selection', () => {
    render(<FileDropZone name="file" label="Upload PDF" accept=".pdf" onChange={() => {}} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'tutorial.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(screen.getByText('tutorial.pdf')).toBeInTheDocument()
  })
})

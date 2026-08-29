import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { DetailScreen } from '../../../../components/home/detail-screen'
import { apiClient } from '../../../../lib/api-client'

jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const mockCreateSignedUrl = jest.fn()
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockCreateSignedUrl(...a) }) } },
}))

const DETAIL = {
  id: '1',
  title: 'Build a Robot Arm',
  description: 'A fun beginner build.',
  difficulty: 'easy',
  status: 'approved',
  // Object path (049), not a URL — the preview button signs it in-process.
  tutorial_pdf_url: '1/tutorial.pdf',
  toy_photo_url: null,
  rejection_note: null,
  created_at: '',
  reviewed_at: null,
  parts: [{ id: 'p1', tutorial_id: '1', name: 'Servo Motor', quantity: 2, is_optional: false, buy_links: [] }],
  tools: [{ id: 't1', tutorial_id: '1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
}

describe('DetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiClient.get as jest.Mock).mockResolvedValue(DETAIL)
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://supabase.test/signed.pdf' }, error: null })
  })

  it('renders tutorial detail with parts and tools', async () => {
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/api/public/tutorials/1')
    expect(screen.getByText('Servo Motor × 2')).toBeTruthy()
    expect(screen.getByText('Screwdriver')).toBeTruthy()
  })

  it('shows an error message when apiClient.get rejects', async () => {
    ;(apiClient.get as jest.Mock).mockRejectedValue(new Error('API GET failed with status 500'))
    render(<DetailScreen id="1" />)
    expect(await screen.findByText("Couldn't load tutorial. Please try again.")).toBeTruthy()
  })

  it('signs the pdf path and pushes the preview route with the signed URL', async () => {
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')

    fireEvent.press(screen.getByText('Preview Tutorial'))

    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('1/tutorial.pdf', 60)
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/home/[id]/preview',
      params: { id: '1', pdfUrl: 'https://supabase.test/signed.pdf' },
    })
  })

  it('pushes the preview route with an empty pdfUrl when signing fails', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')

    fireEvent.press(screen.getByText('Preview Tutorial'))

    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/home/[id]/preview',
      params: { id: '1', pdfUrl: '' },
    })
  })
})

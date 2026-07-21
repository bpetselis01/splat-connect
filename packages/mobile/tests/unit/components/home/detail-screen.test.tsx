import { render, screen } from '@testing-library/react-native'
import { DetailScreen } from '../../../../components/home/detail-screen'
import { apiClient } from '../../../../lib/api-client'

jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const DETAIL = {
  id: '1',
  title: 'Build a Robot Arm',
  description: 'A fun beginner build.',
  difficulty: 'easy',
  status: 'approved',
  tutorial_pdf_url: 'https://example.com/robot-arm.pdf',
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
  })

  it('renders tutorial detail with parts and tools', async () => {
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/api/public/tutorials/1')
    expect(screen.getByText('Servo Motor × 2')).toBeTruthy()
    expect(screen.getByText('Screwdriver')).toBeTruthy()
  })
})

import { render, screen, fireEvent } from '@testing-library/react-native'
import { AbilityScreen } from '../../../../components/profile/ability-screen'
import { QUESTIONS, estimateAbility } from '@splat-connect/types'

let mockProfile: Record<string, unknown> = {}
const mockSave = jest.fn()
jest.mock('../../../../lib/use-child-profile', () => ({
  useChildProfile: () => ({ profile: mockProfile, loading: false, save: mockSave }),
}))

describe('AbilityScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockProfile = {}
  })

  it('saves a manually chosen MACS level with source "manual"', () => {
    render(<AbilityScreen />)
    fireEvent.press(screen.getByText('II'))
    expect(mockSave).toHaveBeenCalledWith({ macs_level: 'II', macs_source: 'manual' })
  })

  it('reveals the assisting-hand control only when hand involvement is unilateral', () => {
    const { rerender } = render(<AbilityScreen />)
    expect(screen.queryByText('Assisting hand')).toBeNull()
    mockProfile = { hand_involvement: 'unilateral' }
    rerender(<AbilityScreen />)
    expect(screen.queryByText('Assisting hand')).toBeTruthy()
  })

  it('estimates MACS/BFMF from the questionnaire and saves with source "estimated"', () => {
    render(<AbilityScreen />)
    fireEvent.press(screen.getByText('Not sure of the clinical terms?'))
    for (const q of QUESTIONS) fireEvent.press(screen.getByText(q.options[0]))
    fireEvent.press(screen.getByText('Estimate'))
    const { macs, bfmf } = estimateAbility([0, 0, 0, 0])
    expect(mockSave).toHaveBeenCalledWith({
      macs_level: macs,
      bfmf_score: bfmf,
      macs_source: 'estimated',
      bfmf_source: 'estimated',
    })
  })
})

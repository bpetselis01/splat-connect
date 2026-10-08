// journeys: Y07
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ItemActions } from '../../../../components/ui/ItemActions'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

const onToast = jest.fn()
const toggle = jest.fn()
const saves = (saved: boolean) => ({ isSaved: () => saved, toggle, savedIds: { tutorials: [], toys: [], challenges: [] } }) as any
const base = { report: { kind: 'guide' as const, id: 'g1', label: 'Robot Arm' }, onToast }
const thanksOf = (over: Partial<{ thanked: boolean; busy: boolean; send: () => Promise<boolean> }> = {}) => ({
  to: 'Sam', thanked: false, busy: false, send: jest.fn().mockResolvedValue(true), ...over,
})
const draw = (props: Partial<React.ComponentProps<typeof ItemActions>> = {}) =>
  render(<ItemActions save={{ slug: 'tutorials', id: 'g1', saves: saves(false) }} {...base} {...props} />)

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({})
})

describe('ItemActions labels and state', () => {
  it('reads Save, Thank Sam and Report a problem when nothing is done yet', () => {
    draw({ thanks: thanksOf() })
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.selected).toBe(false)
    expect(screen.getByRole('button', { name: 'Thank Sam' }).props.accessibilityState.selected).toBe(false)
    expect(screen.getByRole('button', { name: 'Report a problem' })).toBeTruthy()
  })

  it('shows a saved and a thanked guide as selected, with their own words', () => {
    draw({ save: { slug: 'tutorials', id: 'g1', saves: saves(true) }, thanks: thanksOf({ thanked: true }) })
    expect(screen.getByRole('button', { name: 'Saved. Tap to remove from My saves' }).props.accessibilityState.selected).toBe(true)
    expect(screen.getByRole('button', { name: 'Thanked Sam' }).props.accessibilityState.selected).toBe(true)
  })

  it('has no Thanks button when there is nobody to thank', () => {
    draw()
    expect(screen.queryByRole('button', { name: /^Thank/ })).toBeNull()
  })

  it('gives every button a 44pt target', () => {
    draw({ thanks: thanksOf() })
    for (const name of ['Save', 'Thank Sam', 'Report a problem']) {
      const style = [screen.getByRole('button', { name }).props.style].flat(3)
      const flat = Object.assign({}, ...style.filter(Boolean))
      expect(flat.width).toBe(44)
      expect(flat.height).toBe(44)
    }
  })
})

describe('ItemActions Save', () => {
  it('saves, says so, and Undo toggles it back', () => {
    draw()
    fireEvent.press(screen.getByRole('button', { name: 'Save' }))
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(toggle).toHaveBeenCalledWith('tutorials', 'g1')
    expect(onToast).toHaveBeenCalledWith('Saved to My saves', expect.any(Function))
    onToast.mock.calls[0][1]()
    expect(toggle).toHaveBeenCalledTimes(2)
    expect(toggle).toHaveBeenLastCalledWith('tutorials', 'g1')
  })

  it('on a saved guide it removes, says so, and Undo toggles again', () => {
    draw({ save: { slug: 'tutorials', id: 'g1', saves: saves(true) } })
    fireEvent.press(screen.getByRole('button', { name: 'Saved. Tap to remove from My saves' }))
    expect(onToast).toHaveBeenCalledWith('Removed from My saves', expect.any(Function))
    onToast.mock.calls[0][1]()
    expect(toggle).toHaveBeenCalledTimes(2)
  })
})

describe('ItemActions Thanks', () => {
  it('sends and says Thanks sent to Sam', async () => {
    const thanks = thanksOf()
    draw({ thanks })
    fireEvent.press(screen.getByRole('button', { name: 'Thank Sam' }))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Thanks sent to Sam'))
    expect(thanks.send).toHaveBeenCalledTimes(1)
  })

  it('says it could not send when the thanks fails', async () => {
    draw({ thanks: thanksOf({ send: jest.fn().mockResolvedValue(false) }) })
    fireEvent.press(screen.getByRole('button', { name: 'Thank Sam' }))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Could not send that. Try again.'))
  })

  it('does not send twice, and says so', () => {
    const thanks = thanksOf({ thanked: true })
    draw({ thanks })
    fireEvent.press(screen.getByRole('button', { name: 'Thanked Sam' }))
    expect(thanks.send).not.toHaveBeenCalled()
    expect(onToast).toHaveBeenCalledWith('You already thanked Sam')
  })

  it('is disabled while a thanks is on its way', () => {
    const thanks = thanksOf({ busy: true })
    draw({ thanks })
    const button = screen.getByRole('button', { name: 'Thank Sam' })
    expect(button.props.accessibilityState.busy).toBe(true)
    fireEvent.press(button)
    expect(thanks.send).not.toHaveBeenCalled()
  })
})

describe('ItemActions Report', () => {
  it('opens the guide report sheet and files it against this guide', async () => {
    draw()
    fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }))
    expect(screen.getByText('Tell SPLAT what happened')).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    fireEvent.press(screen.getByRole('radio', { name: 'Safety concern' }))
    fireEvent.changeText(screen.getByLabelText('What happened?'), 'Sharp edge')
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ subject_kind: 'guide', subject_id: 'g1', subject_label: 'Robot Arm', category: 'safety' }))
    )
  })
})

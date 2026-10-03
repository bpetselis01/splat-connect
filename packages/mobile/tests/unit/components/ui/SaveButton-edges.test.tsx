import { render, screen, fireEvent } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { SaveButton } from '../../../../components/ui/SaveButton'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}))

const saves = (saved: boolean) => ({ isSaved: () => saved, toggle: jest.fn(), savedIds: {} }) as never

beforeEach(() => jest.clearAllMocks())

it('is named Save when nothing is saved and Saved when it is', () => {
  const view = render(<SaveButton slug="toys" id="y1" saves={saves(false)} />)
  expect(screen.getByLabelText('Save')).toBeTruthy()
  view.rerender(<SaveButton slug="toys" id="y1" saves={saves(true)} />)
  expect(screen.getByLabelText('Saved')).toBeTruthy()
})

it('celebrates a save with a success haptic and an unsave with a light one', () => {
  const s = saves(false)
  const view = render(<SaveButton slug="toys" id="y1" saves={s} />)
  fireEvent.press(screen.getByLabelText('Save'))
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success')
  expect(Haptics.impactAsync).not.toHaveBeenCalled()
  view.rerender(<SaveButton slug="toys" id="y1" saves={saves(true)} />)
  fireEvent.press(screen.getByLabelText('Saved'))
  expect(Haptics.impactAsync).toHaveBeenCalledWith('light')
})

it('still toggles when the haptic engine refuses', () => {
  ;(Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('no taptic'))
  const s = saves(false)
  render(<SaveButton slug="challenges" id="c1" saves={s} />)
  fireEvent.press(screen.getByLabelText('Save'))
  expect((s as unknown as { toggle: jest.Mock }).toggle).toHaveBeenCalledWith('challenges', 'c1')
})

it('passes every tap to toggle, so a double tap reaches the hook twice', () => {
  const s = saves(false)
  render(<SaveButton slug="tutorials" id="t1" saves={s} />)
  fireEvent.press(screen.getByLabelText('Save'))
  fireEvent.press(screen.getByLabelText('Save'))
  expect((s as unknown as { toggle: jest.Mock }).toggle).toHaveBeenCalledTimes(2)
})

it('keeps a 44-point touch target', () => {
  render(<SaveButton slug="tutorials" id="t1" saves={saves(false)} />)
  expect(screen.getByLabelText('Save')).toHaveStyle({ minWidth: 44, minHeight: 44 })
})

import { Alert, Platform } from 'react-native'
import { confirmDestructive, notify } from '../../../lib/confirm'

describe('confirmDestructive', () => {
  const os = Platform.OS
  afterEach(() => {
    Platform.OS = os
    jest.restoreAllMocks()
  })

  it('on web asks through window.confirm, since Alert.alert does nothing there', () => {
    Platform.OS = 'web'
    const ask = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false)
    ;(globalThis as { window?: unknown }).window = { confirm: ask, alert: jest.fn() }
    const onConfirm = jest.fn()

    confirmDestructive('Delete this toy?', 'This cannot be undone.', 'Delete', onConfirm)
    confirmDestructive('Delete this toy?', 'This cannot be undone.', 'Delete', onConfirm)

    expect(ask).toHaveBeenCalledWith('Delete this toy?\n\nThis cannot be undone.')
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('on native shows Alert with a cancel and a destructive button', () => {
    Platform.OS = 'ios'
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const onConfirm = jest.fn()

    confirmDestructive('Remove it?', 'Gone for good.', 'Remove', onConfirm, 'Keep it')

    expect(spy).toHaveBeenCalledWith('Remove it?', 'Gone for good.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onConfirm },
    ])
  })

  it('notify uses window.alert on web', () => {
    Platform.OS = 'web'
    const alert = jest.fn()
    ;(globalThis as { window?: unknown }).window = { confirm: jest.fn(), alert }
    notify('Could not delete this toy', 'Please try again.')
    expect(alert).toHaveBeenCalledWith('Could not delete this toy\n\nPlease try again.')
  })
})

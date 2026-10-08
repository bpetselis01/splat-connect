import { Text, Pressable } from 'react-native'
import { act, render, screen, fireEvent } from '@testing-library/react-native'
import { Toast, useToast } from '../../../../components/ui/Toast'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const onUndo = jest.fn()
let api: ReturnType<typeof useToast>
function Host({ ms }: { ms?: number }) {
  api = useToast(ms)
  return (
    <>
      <Pressable accessibilityLabel="show" onPress={() => api.show('Saved to My saves', onUndo)}><Text>show</Text></Pressable>
      <Toast toast={api.toast} onHide={api.hide} />
    </>
  )
}

beforeEach(() => {
  jest.useFakeTimers()
  onUndo.mockClear()
})
afterEach(() => jest.useRealTimers())

const show = () => fireEvent.press(screen.getByLabelText('show'))

describe('Toast', () => {
  it('shows nothing until something is shown', () => {
    render(<Host />)
    expect(screen.queryByText('Saved to My saves')).toBeNull()
  })

  it('shows its text', () => {
    render(<Host />)
    show()
    expect(screen.getByText('Saved to My saves')).toBeTruthy()
  })

  it('Undo calls the undo and hides the toast', () => {
    render(<Host />)
    show()
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(api.toast).toBeNull()
  })

  it('has no Undo when there is nothing to undo', () => {
    render(<Host />)
    act(() => api.show('Thanks sent to Sam'))
    expect(screen.getByText('Thanks sent to Sam')).toBeTruthy()
    expect(screen.queryByText('Undo')).toBeNull()
  })
})

describe('useToast', () => {
  it('leaves by itself after 2.8 seconds', () => {
    render(<Host />)
    show()
    act(() => { jest.advanceTimersByTime(2799) })
    expect(api.toast).not.toBeNull()
    act(() => { jest.advanceTimersByTime(1) })
    expect(api.toast).toBeNull()
  })

  it('takes its own time', () => {
    render(<Host ms={500} />)
    show()
    act(() => { jest.advanceTimersByTime(500) })
    expect(api.toast).toBeNull()
  })

  it('a second toast restarts the clock and replaces the first', () => {
    render(<Host />)
    show()
    act(() => { jest.advanceTimersByTime(2000) })
    act(() => api.show('Second'))
    act(() => { jest.advanceTimersByTime(2000) })
    expect(api.toast?.text).toBe('Second')
    act(() => { jest.advanceTimersByTime(800) })
    expect(api.toast).toBeNull()
  })

  it('hide() clears it at once', () => {
    render(<Host />)
    show()
    act(() => api.hide())
    expect(api.toast).toBeNull()
  })
})

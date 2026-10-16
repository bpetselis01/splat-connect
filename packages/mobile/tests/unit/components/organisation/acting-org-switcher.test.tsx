import { fireEvent, render, screen } from '@testing-library/react-native'
import { ActingOrgSwitcher } from '../../../../components/organisation/acting-org-switcher'

const ORGS = [
  { id: 'a', name: 'Northside Makers' },
  { id: 'b', name: 'Westside Printers' },
] as never

describe('ActingOrgSwitcher', () => {
  it('renders nothing for a leader of one organisation', () => {
    render(<ActingOrgSwitcher orgs={[ORGS[0]] as never} current="a" onPick={jest.fn()} />)
    expect(screen.queryByLabelText(/Acting for/)).toBeNull()
  })

  it('announces the acting organisation by name', () => {
    render(<ActingOrgSwitcher orgs={ORGS} current="b" onPick={jest.fn()} />)
    expect(screen.getByLabelText('Acting for Westside Printers. Change organisation.')).toBeTruthy()
  })

  it('lists both organisations with the current one checked, and picks the other', () => {
    const onPick = jest.fn()
    render(<ActingOrgSwitcher orgs={ORGS} current="a" onPick={onPick} />)
    fireEvent.press(screen.getByLabelText(/Acting for Northside Makers/))
    expect(screen.getByText(/follow the one you pick/)).toBeTruthy()
    expect(screen.getByLabelText('Northside Makers', { exact: true }).props.accessibilityState).toEqual({ checked: true })
    expect(screen.getByLabelText('Westside Printers', { exact: true }).props.accessibilityState).toEqual({ checked: false })
    fireEvent.press(screen.getByLabelText('Westside Printers', { exact: true }))
    expect(onPick).toHaveBeenCalledWith('b')
  })
})

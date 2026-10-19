import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CustomizationFields } from '../../../../components/my-tutorials/sections/customization-fields'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const onSave = jest.fn().mockResolvedValue(undefined)
beforeEach(() => onSave.mockClear())

it('starts empty, and saves a choice question with its options', async () => {
  render(<CustomizationFields initial={[]} onSave={onSave} />)
  fireEvent.press(screen.getByText('Add a question'))
  fireEvent.changeText(screen.getByLabelText('Field 1 name'), 'Tray thickness')
  fireEvent.changeText(screen.getByLabelText('Field 1 options'), '10 mm\n 15 mm \n\n')
  fireEvent.press(screen.getByText('Save customization fields'))
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith([
      { key: 'tray_thickness', label: 'Tray thickness', kind: 'choice', options: ['10 mm', '15 mm'] },
    ])
  )
  expect(await screen.findByText('Saved')).toBeTruthy()
})

it('saves a number question with its unit and range', async () => {
  render(<CustomizationFields initial={[]} onSave={onSave} />)
  fireEvent.press(screen.getByText('Add a question'))
  fireEvent.changeText(screen.getByLabelText('Field 1 name'), 'Reach')
  fireEvent.press(screen.getByText('A number'))
  fireEvent.changeText(screen.getByLabelText('Field 1 smallest'), '100')
  fireEvent.changeText(screen.getByLabelText('Field 1 largest'), '600')
  fireEvent.press(screen.getByText('Save customization fields'))
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith([{ key: 'reach', label: 'Reach', kind: 'number', unit: 'mm', min: 100, max: 600 }])
  )
})

it('explains a question that is not finished, and saves nothing', () => {
  render(<CustomizationFields initial={[]} onSave={onSave} />)
  fireEvent.press(screen.getByText('Add a question'))
  fireEvent.changeText(screen.getByLabelText('Field 1 name'), 'Tray thickness')
  fireEvent.changeText(screen.getByLabelText('Field 1 options'), '10 mm')
  fireEvent.press(screen.getByText('Save customization fields'))
  expect(screen.getByText('“Tray thickness” needs 2 to 8 options.')).toBeTruthy()
  expect(onSave).not.toHaveBeenCalled()
})

it('removes a question and saves the empty list', async () => {
  render(
    <CustomizationFields initial={[{ key: 'reach', label: 'Reach', kind: 'number', unit: 'mm', min: 100, max: 600 }]} onSave={onSave} />
  )
  fireEvent.press(screen.getByText('Remove this question'))
  fireEvent.press(screen.getByText('Save customization fields'))
  await waitFor(() => expect(onSave).toHaveBeenCalledWith([]))
})

it('stops offering questions at six', () => {
  const six = Array.from({ length: 6 }, (_, i) => ({ key: `q${i}`, label: `Q${i}`, kind: 'choice' as const, options: ['a', 'b'] }))
  render(<CustomizationFields initial={six} onSave={onSave} />)
  expect(screen.queryByText('Add a question')).toBeNull()
})

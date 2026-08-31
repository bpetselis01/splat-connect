import { render, screen, fireEvent } from '@testing-library/react-native'
import { PixelTabBar } from '../../../components/pixel-tab-bar'

const routes = ['guides', 'toy-library', 'explore', 'inbox'].map((name, i) => ({ key: `${name}-${i}`, name }))
const props: any = {
  state: { index: 0, routes, routeNames: routes.map((r) => r.name) },
  descriptors: Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.name === 'toy-library' ? 'Toy Library' : r.name[0].toUpperCase() + r.name.slice(1) } }])),
  navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}

it('draws four tabs around a centre button and badges the inbox', () => {
  const onCentrePress = jest.fn()
  render(<PixelTabBar {...props} badge={8} centreOpen={false} onCentrePress={onCentrePress} />)
  for (const label of ['Guides', 'Toy Library', 'Explore', 'Inbox']) expect(screen.getByText(label)).toBeTruthy()
  expect(screen.getByText('8')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Open My SPLAT'))
  expect(onCentrePress).toHaveBeenCalled()
})

it('sits the centre button between the second and third tab', () => {
  render(<PixelTabBar {...props} badge={0} centreOpen={false} onCentrePress={() => {}} />)
  const labels = screen.getAllByText(/Guides|Toy Library|MY SPLAT|Explore|Inbox/).map((t) => t.props.children)
  expect(labels).toEqual(['Guides', 'Toy Library', 'MY SPLAT', 'Explore', 'Inbox'])
})

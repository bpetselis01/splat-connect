import { Text } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { AnimatedPressable } from '../../../../components/ui/AnimatedPressable'

describe('AnimatedPressable', () => {
  it('renders its children and fires onPress', () => {
    const onPress = jest.fn()
    render(
      <AnimatedPressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Tap me">
        <Text>Tap me</Text>
      </AnimatedPressable>
    )
    fireEvent.press(screen.getByText('Tap me'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

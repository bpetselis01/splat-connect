import { Stack } from 'expo-router'
import { stackScreenOptions, noBarClearance } from '../../../lib/nav-options'

export const unstable_settings = { initialRouteName: 'index' }

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/* The tab root draws its own hero, like the guides and toys roots. */}
      <Stack.Screen name="index" options={{ headerShown: false, ...noBarClearance }} />
    </Stack>
  )
}

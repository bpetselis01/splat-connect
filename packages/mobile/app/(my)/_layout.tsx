// Everything behind MY SPLAT presents modally over the tabs. The tab beneath
// keeps its own stack and its highlight; Close returns to exactly where you were.
import { Pressable } from 'react-native'
import { Redirect, Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { stackScreenOptions } from '../../lib/nav-options'
import { useAuth } from '../../lib/auth-context'
import { theme } from '../../lib/theme'

// The whole (my) group is already presented as one modal by the root layout
// (app/_layout.tsx). Pushes inside this stack are ordinary drill-downs — if
// this inner Stack also carried presentation: 'modal', every push would stack
// as its own modal and lose its back chevron.
function CloseButton() {
  const router = useRouter()
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.dismiss())}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
    >
      <Ionicons name="close" size={24} color={theme.colors.ink} />
    </Pressable>
  )
}

export default function MyLayout() {
  // (my) is a sibling of (tabs) at the root, so the tab layout's gate does not
  // cover it — every one of these screens is its own deep link, and /account
  // reads session!.user. Same three lines, same reason.
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Redirect href="/sign-in" />

  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerBackTitle: 'Back' }}>
      <Stack.Screen name="my-splat" options={{ title: 'My SPLAT', headerLeft: () => <CloseButton /> }} />
      <Stack.Screen name="account/index" options={{ title: 'Account' }} />
      <Stack.Screen name="account/ability" options={{ title: 'Ability Profile' }} />
      <Stack.Screen name="account/everyday-needs" options={{ title: 'Everyday Needs' }} />
      <Stack.Screen name="account/customization" options={{ title: 'Customization Metrics' }} />
      {/* Every screen is named here: an undeclared one takes its route name as the
          header title, so /toys would say "toys/index" over the top of it. */}
      <Stack.Screen name="tutorials/index" options={{ title: 'My tutorials' }} />
      <Stack.Screen name="tutorials/[id]" options={{ title: 'Edit guide' }} />
      <Stack.Screen name="toys/index" options={{ title: 'My toys' }} />
      <Stack.Screen name="toys/new" options={{ title: 'Add a toy' }} />
      <Stack.Screen name="toys/[id]" options={{ title: 'Toy' }} />
      <Stack.Screen name="exchanges/index" options={{ title: 'My exchanges' }} />
      <Stack.Screen name="exchanges/[id]" options={{ title: 'Exchange' }} />
      <Stack.Screen name="challenges/index" options={{ title: 'Design challenges' }} />
      <Stack.Screen name="saved/index" options={{ title: 'Saved' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="print-requests" options={{ title: 'My print requests' }} />
      <Stack.Screen name="organisation/index" options={{ title: 'Review queue' }} />
      <Stack.Screen name="organisation/toys" options={{ title: 'Toy inventory' }} />
      <Stack.Screen name="organisation/orders" options={{ title: 'Print orders' }} />
      <Stack.Screen name="admin" options={{ title: 'Admin' }} />
    </Stack>
  )
}

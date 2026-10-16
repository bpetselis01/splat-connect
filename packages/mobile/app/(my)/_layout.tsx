// Everything behind the Me tab. Pushed over the tabs, not presented: a row on
// Me slides its screen in and the back chevron returns to Me.
import { Redirect, Stack } from 'expo-router'
import { headerRightSlot, stackScreenOptions } from '../../lib/nav-options'
import { useAuthGate } from '../../lib/use-auth-gate'
import { HeaderAddButton } from '../../components/ui/HeaderAddButton'
import { savedTitle } from '../../components/saved/saved-list-screen'


export default function MyLayout() {
  // (my), (tabs), (onboarding) and printing are root siblings and each screen is
  // its own deep link, so every one of them runs the gate.
  const gate = useAuthGate()
  if (gate === 'loading') return null
  if (gate !== 'ok') return <Redirect href={gate} />

  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerBackTitle: 'Back' }}>
      <Stack.Screen name="account/index" options={{ title: 'Account' }} />
      <Stack.Screen name="account/child/[id]" options={{ title: 'Child profile' }} />
      {/* Draws its own back disc and headings, like the sign-in screens it shares parts with. */}
      <Stack.Screen name="account/delete" options={{ headerShown: false }} />
      {/* Every screen is named here: an undeclared one takes its route name as the
          header title, so /toys would say "toys/index" over the top of it. */}
      <Stack.Screen
        name="tutorials/index"
        options={{
          title: 'My tutorials',
          ...headerRightSlot(() => <HeaderAddButton label="Add a tutorial" href="/guides/new" />),
        }}
      />
      {/* The editor is its own nested stack now (tutorials/[id]/_layout.tsx),
          which draws the headers for the hub and its six sections. Leaving this
          one shown would put a second header over the top of them. */}
      <Stack.Screen name="tutorials/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="toys/index" options={{ title: 'My toys' }} />
      <Stack.Screen name="toys/new" options={{ title: 'Add a toy' }} />
      <Stack.Screen name="toys/[id]/index" options={{ title: 'Your toy' }} />
      <Stack.Screen name="toys/[id]/edit" options={{ title: 'Edit listing' }} />
      <Stack.Screen name="exchanges/index" options={{ title: 'My exchanges' }} />
      <Stack.Screen name="exchanges/[id]" options={{ title: 'Exchange' }} />
      <Stack.Screen name="exchanges/build/[id]" options={{ title: 'Build' }} />
      <Stack.Screen name="exchanges/build/ask/[id]" options={{ title: 'Ask first' }} />
      <Stack.Screen name="challenges/index" options={{ title: 'Design challenges' }} />
      <Stack.Screen name="saved/index" options={{ title: 'Saved' }} />
      {/* One route, three titles would need the param at layout level; the
          generic word covers all three lists and the back chevron says where
          you are anyway. */}
      <Stack.Screen
        name="saved/[slug]"
        options={({ route }) => ({ title: savedTitle((route.params as { slug?: string } | undefined)?.slug) })}
      />
      <Stack.Screen name="thanks" options={{ title: 'Thank-you notes' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="print-requests" options={{ title: 'My print requests' }} />
      <Stack.Screen name="print-for-others/index" options={{ title: 'Print for others' }} />
      <Stack.Screen name="print-for-others/add" options={{ title: 'Add a printer' }} />
      <Stack.Screen name="organisation/index" options={{ title: 'Review queue' }} />
      <Stack.Screen name="organisation/[tutorialId]" options={{ title: 'Review' }} />
      <Stack.Screen name="organisation/toys" options={{ title: 'Toy inventory' }} />
      <Stack.Screen name="organisation/orders" options={{ title: 'Print orders' }} />
      <Stack.Screen name="organisation/recycling" options={{ title: 'Recycling intake' }} />
      <Stack.Screen name="organisation/messages" options={{ title: 'Messages' }} />
      <Stack.Screen name="organisation/requests" options={{ title: 'Requests to you' }} />
      <Stack.Screen name="organisation/publish" options={{ title: 'Events and stories' }} />
      <Stack.Screen name="organisation/events/new" options={{ title: 'Publish an event' }} />
      <Stack.Screen name="organisation/events/[id]" options={{ title: 'Manage event' }} />
      <Stack.Screen name="organisation/stories/new" options={{ title: 'Publish a story' }} />
      <Stack.Screen name="organisation/profile"options={{ title: 'Organisation profile' }} />
      <Stack.Screen name="events" options={{ title: 'My events' }} />
      {/* 077: a conversation with an organisation, from either side. */}
      <Stack.Screen name="messages/[cid]" options={{ title: 'Conversation' }} />
      <Stack.Screen name="messages/org/[orgId]" options={{ title: 'Message' }} />
      <Stack.Screen name="news/[kind]/[id]" options={{ title: '' }} />
      <Stack.Screen name="admin" options={{ title: 'Admin' }} />
      <Stack.Screen name="admin/review/index" options={{ title: 'Guides to review' }} />
      <Stack.Screen name="admin/review/[id]" options={{ title: 'Review' }} />
      <Stack.Screen name="admin/reports/index" options={{ title: 'Reports from members' }} />
      <Stack.Screen name="admin/reports/[id]" options={{ title: 'Report' }} />
      <Stack.Screen name="admin/ideas/index" options={{ title: 'Ideas to review' }} />
      <Stack.Screen name="admin/ideas/[id]" options={{ title: 'Idea' }} />
      <Stack.Screen name="admin/spot-check" options={{ title: 'Spot-check' }} />
      <Stack.Screen name="admin/accounts" options={{ title: 'Accounts' }} />
      <Stack.Screen name="admin/organisations/index" options={{ title: 'Organisations' }} />
      <Stack.Screen name="admin/organisations/new" options={{ title: 'New organisation' }} />
      <Stack.Screen name="admin/organisations/[id]" options={{ title: 'Organisation' }} />
    </Stack>
  )
}

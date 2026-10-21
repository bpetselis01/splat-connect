import { useLocalSearchParams } from 'expo-router'
import { EventRegistrationsScreen } from '../../../../components/organisation/event-registrations-screen'

export default function ManageEvent() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EventRegistrationsScreen eventId={id} />
}

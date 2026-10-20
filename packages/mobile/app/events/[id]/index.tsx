import { useLocalSearchParams } from 'expo-router'
import { EventDetailScreen } from '../../../components/events/event-detail-screen'

// PENDING(event-detail-ready-marker): the button is disabled with a subtle spinner until the viewer profile and capabilities have loaded; the e2e...

export default function EventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EventDetailScreen id={id} />
}

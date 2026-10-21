import { useLocalSearchParams } from 'expo-router'
import { EventDetailScreen } from '../../../components/events/event-detail-screen'

export default function EventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EventDetailScreen id={id} />
}

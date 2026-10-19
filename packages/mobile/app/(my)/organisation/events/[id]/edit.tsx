import { useLocalSearchParams } from 'expo-router'
import { EditEventScreen } from '../../../../../components/organisation/event-form-screen'

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EditEventScreen eventId={id} />
}

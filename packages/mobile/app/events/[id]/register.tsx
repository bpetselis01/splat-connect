import { Redirect, useLocalSearchParams } from 'expo-router'
import { EventRegisterScreen } from '../../../components/events/event-register-screen'
import { useAuthGate } from '../../../lib/use-auth-gate'

export default function EventRegisterRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const gate = useAuthGate()
  if (gate === 'loading') return null
  if (gate !== 'ok') return <Redirect href={gate} />
  return <EventRegisterScreen id={id} />
}

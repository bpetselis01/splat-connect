import { Redirect, useLocalSearchParams } from 'expo-router'
import { PrintAtEventScreen } from '../../../components/events/print-at-event-screen'
import { useAuthGate } from '../../../lib/use-auth-gate'

export default function PrintAtEventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const gate = useAuthGate()
  if (gate === 'loading') return null
  if (gate !== 'ok') return <Redirect href={gate} />
  return <PrintAtEventScreen id={id} />
}

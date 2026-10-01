import { useLocalSearchParams } from 'expo-router'
import { ExchangeThreadScreen } from '../../../components/exchanges/thread-screen'

export default function ExchangeThreadRoute() {
  const { id, accept } = useLocalSearchParams<{ id: string; accept?: string }>()
  return <ExchangeThreadScreen id={id} startAccept={accept === '1'} />
}

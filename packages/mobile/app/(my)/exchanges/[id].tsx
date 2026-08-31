import { useLocalSearchParams } from 'expo-router'
import { ExchangeThreadScreen } from '../../../components/exchanges/thread-screen'

export default function ExchangeThreadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ExchangeThreadScreen id={id} />
}

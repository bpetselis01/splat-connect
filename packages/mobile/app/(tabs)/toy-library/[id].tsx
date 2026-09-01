import { useLocalSearchParams } from 'expo-router'
import { ToyDetailScreen } from '../../../components/toys/toy-detail-screen'

export default function ToyDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ToyDetailScreen id={id} />
}

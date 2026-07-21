import { useLocalSearchParams } from 'expo-router'
import { DetailScreen } from '../../../../components/home/detail-screen'

export default function TutorialDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <DetailScreen id={id} />
}

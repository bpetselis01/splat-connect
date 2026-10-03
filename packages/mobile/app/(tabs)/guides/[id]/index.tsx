import { useLocalSearchParams } from 'expo-router'
import { DetailScreen } from '../../../../components/home/detail-screen'

export default function TutorialDetailRoute() {
  const { id, printWith } = useLocalSearchParams<{ id: string; printWith?: string }>()
  return <DetailScreen id={id} printWith={printWith} />
}

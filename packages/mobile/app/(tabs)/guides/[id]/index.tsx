import { useLocalSearchParams } from 'expo-router'
import { DetailScreen } from '../../../../components/home/detail-screen'

export default function TutorialDetailRoute() {
  const { id, printWith, tab } = useLocalSearchParams<{ id: string; printWith?: string; tab?: string }>()
  return <DetailScreen id={id} printWith={printWith} tab={tab} />
}

import { useLocalSearchParams } from 'expo-router'
import { ShowcaseScreen } from '../../../../components/guides/showcase-screen'

export default function ContributorShowcaseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ShowcaseScreen kind="person" id={id} />
}

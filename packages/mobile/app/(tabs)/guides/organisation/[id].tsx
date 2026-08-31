import { useLocalSearchParams } from 'expo-router'
import { ShowcaseScreen } from '../../../../components/guides/showcase-screen'

export default function OrganisationShowcaseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ShowcaseScreen kind="org" id={id} />
}

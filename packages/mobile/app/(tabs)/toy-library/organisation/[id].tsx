import { useLocalSearchParams } from 'expo-router'
import { OrgProfileScreen } from '../../../../components/organisation/org-profile-screen'

export default function OrganisationProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <OrgProfileScreen id={id} />
}

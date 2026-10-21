// packages/mobile/app/(my)/admin/organisations/[id].tsx
import { useLocalSearchParams } from 'expo-router'
import { OrganisationManageScreen } from '../../../../components/admin/organisation-manage-screen'

export default function AdminOrganisationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <OrganisationManageScreen orgId={id} />
}

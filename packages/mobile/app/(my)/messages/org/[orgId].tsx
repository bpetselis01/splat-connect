import { useLocalSearchParams } from 'expo-router'
import { OrgConversationScreen } from '../../../../components/organisation/org-conversation-screen'

// The Message button on an organisation's profile: your own conversation with
// it, or the composer that starts one.
export default function MessageOrgRoute() {
  const { orgId, name } = useLocalSearchParams<{ orgId: string; name?: string }>()
  return <OrgConversationScreen orgId={orgId} orgName={name} />
}

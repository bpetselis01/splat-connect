import { useLocalSearchParams } from 'expo-router'
import { OrgConversationScreen } from '../../../components/organisation/org-conversation-screen'

export default function OrgConversationRoute() {
  const { cid } = useLocalSearchParams<{ cid: string }>()
  return <OrgConversationScreen cid={cid} />
}

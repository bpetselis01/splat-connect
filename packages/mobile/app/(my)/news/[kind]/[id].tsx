import { useLocalSearchParams } from 'expo-router'
import { OrgNewsScreen } from '../../../../components/organisation/org-news-screen'

export default function OrgNewsRoute() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>()
  return <OrgNewsScreen kind={kind === 'story' ? 'story' : 'event'} id={id} />
}

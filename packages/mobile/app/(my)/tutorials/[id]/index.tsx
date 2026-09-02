import { useLocalSearchParams } from 'expo-router'
import { TutorialHub } from '../../../../components/my-tutorials/hub'

export default function TutorialHubRoute() {
  const { id, justCreated } = useLocalSearchParams<{ id: string; justCreated?: string }>()
  return <TutorialHub id={id} justCreated={justCreated === '1'} />
}

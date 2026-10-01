import { useLocalSearchParams } from 'expo-router'
import { AskFirstScreen } from '../../../../../components/builds/ask-first-screen'

export default function AskFirstRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <AskFirstScreen id={id} />
}

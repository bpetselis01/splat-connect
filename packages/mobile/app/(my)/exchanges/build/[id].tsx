import { useLocalSearchParams } from 'expo-router'
import { BuildThreadScreen } from '../../../../components/builds/build-thread-screen'

export default function BuildThreadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <BuildThreadScreen id={id} />
}

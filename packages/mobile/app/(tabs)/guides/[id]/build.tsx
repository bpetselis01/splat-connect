import { useLocalSearchParams } from 'expo-router'
import { BuildMode } from '../../../../components/guides/build-mode'

export default function GuideBuildRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <BuildMode id={id} />
}

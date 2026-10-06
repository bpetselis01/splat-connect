import { useLocalSearchParams } from 'expo-router'
import { BuildMode } from '../../../../components/guides/build-mode'

export default function GuideBuildRoute() {
  // step: the guide page's step rows open build mode on that step.
  const { id, step } = useLocalSearchParams<{ id: string; step?: string }>()
  return <BuildMode id={id} step={step} />
}

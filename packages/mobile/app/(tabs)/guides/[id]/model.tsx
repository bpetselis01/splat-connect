import { useLocalSearchParams } from 'expo-router'
import { ModelScreen } from '../../../../components/guides/model-screen'

export default function TutorialModelRoute() {
  const { id, file } = useLocalSearchParams<{ id: string; file: string }>()
  return <ModelScreen id={id} file={file} />
}

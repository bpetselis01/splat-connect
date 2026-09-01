import { useLocalSearchParams } from 'expo-router'
import { Editor } from '../../../components/my-tutorials/editor'

export default function EditGuideRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Editor id={id} />
}

import { useLocalSearchParams } from 'expo-router'
import { Editor } from '../../../components/my-toys/editor'

export default function EditToyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Editor id={id} />
}

import { useLocalSearchParams } from 'expo-router'
import { Editor } from '../../../components/my-toys/editor'

// PENDING(my-toy-summary): the board opens a toy on a summary (lead, Edit
// listing, Mark unavailable), not straight into the editor.
export default function EditToyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Editor id={id} />
}

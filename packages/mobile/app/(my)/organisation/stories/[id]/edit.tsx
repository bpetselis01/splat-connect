import { useLocalSearchParams } from 'expo-router'
import { EditStoryScreen } from '../../../../../components/organisation/story-form-screen'

export default function EditStory() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EditStoryScreen storyId={id} />
}

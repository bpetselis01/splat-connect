import { useLocalSearchParams } from 'expo-router'
import { PreviewScreen } from '../../../../components/home/preview-screen'

export default function TutorialPreviewRoute() {
  const { id, pdfUrl } = useLocalSearchParams<{ id: string; pdfUrl?: string }>()
  return <PreviewScreen pdfUrl={pdfUrl || null} tutorialId={id} />
}

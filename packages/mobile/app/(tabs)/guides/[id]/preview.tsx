import { useLocalSearchParams } from 'expo-router'
import { PreviewScreen } from '../../../../components/home/preview-screen'

export default function TutorialPreviewRoute() {
  const { pdfUrl } = useLocalSearchParams<{ pdfUrl?: string }>()
  return <PreviewScreen pdfUrl={pdfUrl || null} />
}

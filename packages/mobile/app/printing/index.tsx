import { useLocalSearchParams } from 'expo-router'
import { FindPrinterScreen } from '../../components/printing/find-screen'

export default function FindPrinterRoute() {
  const { guide } = useLocalSearchParams<{ guide?: string }>()
  return <FindPrinterScreen guideId={guide} />
}

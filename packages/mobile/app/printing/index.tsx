import { useLocalSearchParams } from 'expo-router'
import { FindPrinterScreen } from '../../components/printing/find-screen'

export default function FindPrinterRoute() {
  const { guide, printWith } = useLocalSearchParams<{ guide?: string; printWith?: string }>()
  return <FindPrinterScreen guideId={guide} printWith={printWith} />
}

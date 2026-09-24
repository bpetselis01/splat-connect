import { useLocalSearchParams } from 'expo-router'
import { RequestPrintScreen } from '../../components/printing/request-screen'

export default function RequestPrintRoute() {
  const { guide, printers } = useLocalSearchParams<{ guide: string; printers?: string }>()
  return <RequestPrintScreen guideId={guide} printerIds={(printers ?? '').split(',').filter(Boolean)} />
}

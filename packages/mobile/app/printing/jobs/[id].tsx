import { useLocalSearchParams } from 'expo-router'
import { PrintJobScreen } from '../../../components/printing/job-screen'

export default function PrintJobRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <PrintJobScreen id={id} />
}

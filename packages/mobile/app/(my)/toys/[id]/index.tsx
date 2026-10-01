import { useLocalSearchParams } from 'expo-router'
import { ToySummaryScreen } from '../../../../components/my-toys/summary-screen'

export default function ToySummaryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ToySummaryScreen id={id} />
}

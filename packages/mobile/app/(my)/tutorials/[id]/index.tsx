import { useLocalSearchParams } from 'expo-router'
import { TutorialHub } from '../../../../components/my-tutorials/hub'

export default function TutorialHubRoute() {
  const { id, justCreated, fromPdf, stepsLater, missed } = useLocalSearchParams<{
    id: string
    justCreated?: string
    fromPdf?: string
    stepsLater?: string
    missed?: string
  }>()
  return (
    <TutorialHub
      id={id}
      justCreated={justCreated === '1'}
      fromPdf={
        fromPdf === '1' ? { stepsLater: stepsLater === '1', missed: missed ? missed.split(',') : [] } : undefined
      }
    />
  )
}

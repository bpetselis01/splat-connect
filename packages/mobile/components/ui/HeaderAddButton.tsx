// packages/mobile/components/ui/HeaderAddButton.tsx
//
// headerRight for a list whose board puts its add action in the header: a
// "+" in the same disc as BackButton, named for what it adds.
import { useRouter, type Href } from 'expo-router'
import { BackButton } from './BackButton'

export function HeaderAddButton({ label, href }: { label: string; href: Href }) {
  const router = useRouter()
  return <BackButton label={label} icon="add" onPress={() => router.push(href)} />
}

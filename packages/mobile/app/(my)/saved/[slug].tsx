// packages/mobile/app/(my)/saved/[slug].tsx
import { useLocalSearchParams } from 'expo-router'
import { SAVE_SLUGS, type SaveSlug } from '@splat-connect/types'
import { SavedListScreen } from '../../../components/saved/saved-list-screen'
import { SavedScreen } from '../../../components/saved/saved-screen'

export default function SavedListRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  // An unknown slug (a stale deep link) falls back to the hub rather than a
  // screen that would 404 its every fetch.
  if (!Object.hasOwn(SAVE_SLUGS, slug)) return <SavedScreen />
  return <SavedListScreen slug={slug as SaveSlug} />
}

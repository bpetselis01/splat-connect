// packages/mobile/app/(tabs)/explore/learn/[slug].tsx
import { useLocalSearchParams } from 'expo-router'
import { ArticleScreen } from '../../../../components/explore/article-screen'

export default function ArticleRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  return <ArticleScreen slug={slug} />
}

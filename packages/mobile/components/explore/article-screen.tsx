// packages/mobile/components/explore/article-screen.tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { theme } from '../../lib/theme'
import { useLearnProgress } from '../../lib/learn'
import { LEARN_ARTICLES } from '../../lib/learn-content'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

export function ArticleScreen({ slug }: { slug: string }) {
  const router = useRouter()
  const { read, markRead } = useLearnProgress()
  const article = LEARN_ARTICLES.find((a) => a.slug === slug)

  if (!article) {
    return (
      <Screen>
        <EmptyState icon="help-circle-outline" title="We couldn't find that article." />
      </Screen>
    )
  }

  const isRead = read.has(slug)

  return (
    <Screen>
      {/* The layout registers a static "Guide" fallback; this overrides it
          with the real title once the article is known. */}
      <Stack.Screen options={{ title: article.title }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.intro}>{article.intro}</Text>

        {article.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, i) => (
              <Text key={i} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        {isRead ? (
          <Text style={styles.readState}>✓ Read</Text>
        ) : (
          <Button
            label="Mark as read"
            onPress={() => {
              markRead(slug)
              router.back()
            }}
            style={styles.markButton}
          />
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(8) },
  title: { fontFamily: theme.fonts.bold, fontSize: theme.type.title, color: theme.colors.text, lineHeight: 30 },
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 22,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(5),
  },
  section: { marginBottom: theme.spacing(5) },
  heading: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  paragraph: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.body,
    color: theme.colors.text,
    lineHeight: 26,
    marginBottom: theme.spacing(3),
  },
  markButton: { marginTop: theme.spacing(2) },
  readState: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.mintDeep,
    textAlign: 'center',
    marginTop: theme.spacing(2),
  },
})

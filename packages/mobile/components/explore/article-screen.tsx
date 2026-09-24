// packages/mobile/components/explore/article-screen.tsx
// The board's article: one idea per heading, a callout for the thing people get
// wrong, and the next article as the only footer action. Reaching the footer is
// finishing the article, so the footer marks it read.
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { useLearnProgress } from '../../lib/learn'
import { LEARN_ARTICLES } from '../../lib/learn-content'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

export function ArticleScreen({ slug }: { slug: string }) {
  const router = useRouter()
  const { markRead } = useLearnProgress()
  const index = LEARN_ARTICLES.findIndex((a) => a.slug === slug)
  const article = LEARN_ARTICLES[index]

  if (!article) {
    return (
      <Screen>
        <EmptyState icon="help-circle-outline" title="We couldn't find that article." />
      </Screen>
    )
  }

  const next = LEARN_ARTICLES[index + 1] ?? null

  return (
    <Screen>
      {/* The layout registers a static "Guide" fallback; this overrides it
          with the real title once the article is known. */}
      <Stack.Screen options={{ title: article.title }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{`Learn · ${index + 1} of ${LEARN_ARTICLES.length}`}</Text>
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
            {section.callout ? (
              <View testID="article-callout" style={styles.callout}>
                <Ionicons name="warning-outline" size={18} color={theme.colors.ink} />
                <Text style={styles.calloutText}>{section.callout}</Text>
              </View>
            ) : null}
          </View>
        ))}

        <Button
          label={next ? `Next: ${next.title}` : 'Back to Learn'}
          onPress={() => {
            markRead(slug)
            if (next) router.replace(`/explore/learn/${next.slug}`)
            else router.back()
          }}
          style={styles.next}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(8) },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.primaryDeep,
    marginBottom: theme.spacing(1),
  },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.text, lineHeight: 30 },
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.body,
    color: theme.colors.muted,
    lineHeight: 23,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(5),
  },
  section: { marginBottom: theme.spacing(5) },
  heading: {
    fontFamily: theme.fonts.display,
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
  callout: {
    flexDirection: 'row',
    gap: theme.spacing(2),
    padding: theme.spacing(4),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.honeySoft,
  },
  calloutText: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    lineHeight: 21,
  },
  next: { marginTop: theme.spacing(2) },
})

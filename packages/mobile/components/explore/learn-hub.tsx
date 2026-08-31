// packages/mobile/components/explore/learn-hub.tsx
// Title comes from the native header (app/(tabs)/explore/_layout.tsx), so
// this doesn't repeat it — same convention as about-screen.tsx.
import { View, Text, Linking, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { useLearnProgress } from '../../lib/learn'
import { LEARN_ARTICLES } from '../../lib/learn-content'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Meter } from '../ui/Meter'
import { AnimatedPressable } from '../ui/AnimatedPressable'

function openWebPage(path: string) {
  Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}${path}`)
}

export function LearnHub() {
  const router = useRouter()
  const { read, next, count } = useLearnProgress()
  const total = LEARN_ARTICLES.length
  const nextPosition = next ? LEARN_ARTICLES.findIndex((a) => a.slug === next.slug) + 1 : 0

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {next ? (
          <AnimatedPressable
            onPress={() => router.push(`/explore/learn/${next.slug}`)}
            accessibilityRole="button"
            accessibilityLabel={`Continue: ${nextPosition}. ${next.title}`}
            accessibilityHint={`${next.minutes} minutes left`}
            pressScale={0.985}
            style={styles.continuePress}
          >
            <Card variant="feature" style={styles.continueCard}>
              <Text style={styles.eyebrow}>CONTINUE</Text>
              <Text style={styles.continueTitle}>{`${nextPosition} · ${next.title}`}</Text>
              <Meter value={count} max={total} width={120} />
              <Text style={styles.continueCaption}>
                {`${count} of ${total} read · ${next.minutes} min left on this one ›`}
              </Text>
            </Card>
          </AnimatedPressable>
        ) : (
          <Text style={styles.allRead}>All six read.</Text>
        )}

        <View style={styles.path}>
          {LEARN_ARTICLES.map((article, i) => {
            const position = i + 1
            const isRead = read.has(article.slug)
            const isCurrent = next?.slug === article.slug
            const isLast = i === LEARN_ARTICLES.length - 1

            return (
              <AnimatedPressable
                key={article.slug}
                onPress={() => router.push(`/explore/learn/${article.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={`${position}. ${article.title}`}
                accessibilityHint={isRead ? 'Read' : `${article.minutes} min`}
                pressScale={0.99}
                style={styles.pathItem}
              >
                <View style={styles.nodeColumn}>
                  <View style={[styles.node, isRead && styles.nodeRead, isCurrent && styles.nodeCurrent]}>
                    {/*
                      The numeral/tick is decorative — the row's own
                      accessibilityLabel already carries the position and
                      title, so a screen reader repeating "1" or "check mark"
                      ahead of it would say less than the label says on its
                      own. Same hidden-glyph convention as StepPills.
                    */}
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      aria-hidden
                      testID={`learn-node-${isRead ? 'check' : 'numeral'}-${article.slug}`}
                    >
                      <Text style={[styles.nodeText, isRead && styles.nodeTextRead]}>
                        {isRead ? '✓' : String(position)}
                      </Text>
                    </View>
                  </View>
                  {!isLast ? <View style={styles.connector} /> : null}
                </View>
                <Card style={styles.pathCard}>
                  <Text style={styles.pathTitle}>{article.title}</Text>
                  <Text style={styles.pathIntro} numberOfLines={2}>
                    {article.intro}
                  </Text>
                  <Text style={styles.pathCaption}>{isRead ? 'Read' : `${article.minutes} min`}</Text>
                </Card>
              </AnimatedPressable>
            )
          })}
        </View>

        <AnimatedPressable
          onPress={() => openWebPage('/learn/ask-an-expert')}
          accessibilityRole="link"
          accessibilityLabel="Ask an expert"
          pressScale={0.99}
          style={styles.askRow}
        >
          <Text style={styles.askLabel}>Ask an expert</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
        </AnimatedPressable>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  continuePress: { marginBottom: theme.spacing(5) },
  continueCard: { gap: theme.spacing(2) },
  eyebrow: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  continueTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.heading, color: theme.colors.text },
  continueCaption: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
  allRead: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing(5),
  },
  path: { marginBottom: theme.spacing(5) },
  pathItem: { flexDirection: 'row', gap: theme.spacing(3), marginBottom: theme.spacing(4) },
  nodeColumn: { alignItems: 'center', width: 28 },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeRead: { backgroundColor: theme.colors.mint },
  nodeCurrent: { backgroundColor: theme.colors.apricot, ...theme.shadow(3) },
  nodeText: { fontFamily: theme.fonts.numeral, fontSize: 17, color: theme.colors.ink, lineHeight: 20 },
  nodeTextRead: { color: theme.colors.mintDeep },
  // Stretches to the row's full height (the tallest sibling, the body card)
  // so it visually runs down to the next node — it stops short of the next
  // circle by the row's own marginBottom gap, which is accepted.
  connector: { width: 2, flex: 1, backgroundColor: theme.colors.ink, marginVertical: theme.spacing(1) },
  pathCard: { flex: 1 },
  pathTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  pathIntro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
    lineHeight: 18,
  },
  pathCaption: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
    marginTop: theme.spacing(1),
  },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    ...theme.shadow(3),
  },
  askLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
})

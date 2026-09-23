// packages/mobile/components/explore/learn-hub.tsx
// Title comes from the native header (app/(tabs)/explore/_layout.tsx), so
// this doesn't repeat it — same convention as about-screen.tsx.
import { View, Text, Linking, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { useLearnProgress } from '../../lib/learn'
import { LEARN_ARTICLES, type LearnArticle } from '../../lib/learn-content'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Meter } from '../ui/Meter'
import { AnimatedPressable } from '../ui/AnimatedPressable'

function openWebPage(path: string) {
  Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}${path}`)
}

const START_HERE = 3

/** The board's order: the first three numbered as the path in, the rest below. */
export function learnSections(articles: LearnArticle[]) {
  return { start: articles.slice(0, START_HERE), deeper: articles.slice(START_HERE) }
}

// No "SOON" rows: every article and Ask an expert are built. A row for an
// unbuilt page would be the one place to add it.
const DEEPER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'tools-and-materials': 'construct-outline',
  'safety-and-cleaning': 'shield-checkmark-outline',
  'printing-basics': 'print-outline',
}

export function LearnHub() {
  const router = useRouter()
  const { read, next, count } = useLearnProgress()
  const total = LEARN_ARTICLES.length
  const nextPosition = next ? LEARN_ARTICLES.findIndex((a) => a.slug === next.slug) + 1 : 0
  const { start, deeper } = learnSections(LEARN_ARTICLES)

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          How switch adaptation works, from first switch to safe finish. For instructions on one toy, use Guides.
        </Text>

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

        <Text style={styles.sectionLabel}>Start here</Text>
        <View style={styles.list}>
          {start.map((article, i) => (
            <LearnRow
              key={article.slug}
              article={article}
              label={`${i + 1}. ${article.title}`}
              read={read.has(article.slug)}
              tile={String(i + 1)}
              onPress={() => router.push(`/explore/learn/${article.slug}`)}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Going deeper</Text>
        <View style={styles.list}>
          {deeper.map((article) => (
            <LearnRow
              key={article.slug}
              article={article}
              label={article.title}
              read={read.has(article.slug)}
              icon={DEEPER_ICON[article.slug] ?? 'book-outline'}
              onPress={() => router.push(`/explore/learn/${article.slug}`)}
            />
          ))}
          <AnimatedPressable
            onPress={() => openWebPage('/learn/ask-an-expert')}
            accessibilityRole="link"
            accessibilityLabel="Ask an expert"
            pressScale={0.985}
            style={styles.row}
          >
            <View style={[styles.tile, styles.tileIcon]}>
              <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.ink} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Ask an expert</Text>
              <Text style={styles.rowIntro}>Put a question to an OT or a maker.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </AnimatedPressable>
        </View>
      </ScrollView>
    </Screen>
  )
}

/** One Learn row: a numbered tile in Start here, an icon tile below it, a tick once read. */
function LearnRow({
  article,
  label,
  read,
  tile,
  icon,
  onPress,
}: {
  article: LearnArticle
  label: string
  read: boolean
  tile?: string
  icon?: keyof typeof Ionicons.glyphMap
  onPress: () => void
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={read ? 'Read' : `${article.minutes} min`}
      pressScale={0.985}
      style={styles.row}
    >
      <View style={[styles.tile, read ? styles.tileRead : tile ? styles.tileNumber : styles.tileIcon]}>
        {/*
          The numeral/tick is decorative — the row's own accessibilityLabel
          already carries the position and title, so a screen reader repeating
          "1" or "check mark" ahead of it would say less than the label says on
          its own. Same hidden-glyph convention as StepPills.
        */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          testID={`learn-node-${read ? 'check' : tile ? 'numeral' : 'icon'}-${article.slug}`}
        >
          {read ? (
            <Text style={styles.tileText}>✓</Text>
          ) : tile ? (
            <Text style={styles.tileText}>{tile}</Text>
          ) : (
            <Ionicons name={icon ?? 'book-outline'} size={20} color={theme.colors.ink} />
          )}
        </View>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{article.title}</Text>
        <Text style={styles.rowIntro} numberOfLines={2}>
          {article.intro}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
    marginBottom: theme.spacing(4),
  },
  continuePress: { marginBottom: theme.spacing(5) },
  continueCard: { gap: theme.spacing(2) },
  eyebrow: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  continueTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.text },
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
  sectionLabel: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginBottom: theme.spacing(2),
  },
  list: { gap: theme.spacing(3), marginBottom: theme.spacing(5) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(1),
  },
  tile: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileNumber: { backgroundColor: theme.colors.honeySoft },
  tileIcon: { backgroundColor: theme.colors.surfaceSunken },
  tileRead: { backgroundColor: theme.colors.mintSoft },
  tileText: { fontFamily: theme.fonts.display, fontSize: 15, color: theme.colors.ink },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: theme.fonts.black, fontSize: 15, color: theme.colors.text },
  rowIntro: { fontFamily: theme.fonts.regular, fontSize: 12.5, color: theme.colors.muted, lineHeight: 18 },
})

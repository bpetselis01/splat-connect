// packages/mobile/components/explore/learn-hub.tsx
// Title comes from the native header (app/(tabs)/explore/_layout.tsx), so
// this doesn't repeat it — same convention as about-screen.tsx.
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import type { LearnCourse } from '@splat-connect/types'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { apiClient } from '../../lib/api-client'
import { useLearnProgress } from '../../lib/learn'
import { LEARN_ARTICLES, type LearnArticle } from '../../lib/learn-content'
import { Screen } from '../ui/Screen'
import { AnimatedPressable } from '../ui/AnimatedPressable'

const START_HERE = 3

/** The board's order: the first three numbered as the path in, the rest below. */
export function learnSections(articles: LearnArticle[]) {
  return { start: articles.slice(0, START_HERE), deeper: articles.slice(START_HERE) }
}

// No "SOON" rows: every article is built. Ask an expert stays on the web only
// (decided 2026-09-30).
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

  // site-content-learn-legal-editing: Site content's course title, outcome and
  // "Shown as". The app's articles are flat (no units or lessons), so that is
  // all of the outline it can use; sign-in-needed reads as Free here, because
  // the articles ship inside the app. Hidden hides it from everyone here,
  // admins included: the course an admin previews is the web's. A failed read
  // keeps the app's own words.
  const [course, setCourse] = useState<LearnCourse | null>(null)
  useEffect(() => {
    let ignore = false
    apiClient
      .get<LearnCourse>('/api/public/learn-course')
      .then((c) => {
        if (!ignore) setCourse(c)
      })
      .catch((err) => console.error('[LearnHub] course fetch failed:', err))
    return () => {
      ignore = true
    }
  }, [])

  if (course?.shown_as === 'hidden') {
    return (
      <Screen>
        <Text style={styles.allRead}>Course hidden</Text>
      </Screen>
    )
  }

  const avgMinutes = Math.round(LEARN_ARTICLES.reduce((n, a) => n + a.minutes, 0) / total)

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {course?.title ? (
          <Text accessibilityRole="header" style={styles.courseTitle}>
            {course.title}
          </Text>
        ) : null}
        <Text style={styles.intro}>
          {course?.outcome ??
            `How switch adaptation works, from first switch to safe finish. ${total} short reads, about ${avgMinutes} minutes each.`}
        </Text>

        {next ? (
          <AnimatedPressable
            onPress={() => router.push(`/explore/learn/${next.slug}`)}
            accessibilityRole="button"
            accessibilityLabel={`Continue: ${nextPosition}. ${next.title}`}
            accessibilityHint={`${next.minutes} minutes`}
            pressScale={0.985}
            style={styles.upNext}
          >
            <Text style={styles.upNextLabel}>{`Up next · ${next.minutes} min`}</Text>
            <Text style={styles.upNextTitle}>{`${nextPosition} · ${next.title}`}</Text>
            <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {LEARN_ARTICLES.map((a) => (
                <View key={a.slug} style={[styles.segment, read.has(a.slug) && styles.segmentRead]} />
              ))}
            </View>
            <View style={styles.upNextFoot}>
              <Text style={styles.upNextCount}>{`${count} of ${total} read`}</Text>
              <View style={styles.keepReading}>
                <Text style={styles.keepReadingText}>Keep reading</Text>
                <Ionicons name="arrow-forward" size={16} color={theme.colors.onInverse} />
              </View>
            </View>
          </AnimatedPressable>
        ) : (
          <Text style={styles.allRead}>All six read.</Text>
        )}

        <Text accessibilityRole="header" style={styles.sectionTitle}>Start here</Text>
        <View style={styles.path}>
          {start.map((article, i) => {
            const done = read.has(article.slug)
            const isNext = next?.slug === article.slug
            const last = i === start.length - 1
            return (
              <AnimatedPressable
                key={article.slug}
                onPress={() => router.push(`/explore/learn/${article.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}. ${article.title}`}
                accessibilityHint={done ? 'Read' : `${article.minutes} min`}
                pressScale={0.985}
                style={styles.pathRow}
              >
                <View style={styles.rail}>
                  <View style={[styles.node, done ? styles.nodeRead : isNext ? styles.nodeNext : null]}>
                    {/* Decorative: the row's label already says the position. */}
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      aria-hidden
                      testID={`learn-node-${done ? 'check' : 'numeral'}-${article.slug}`}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={18} color={theme.colors.onColor} />
                      ) : (
                        <Text style={[styles.nodeText, isNext && styles.onColor]}>{i + 1}</Text>
                      )}
                    </View>
                  </View>
                  {last ? null : <View style={[styles.line, done && styles.lineRead]} />}
                </View>
                <View style={[styles.pathText, last && styles.pathTextLast]}>
                  <Text style={[styles.rowTitle, done && styles.muted]}>{article.title}</Text>
                  <Text style={styles.rowSub} numberOfLines={2}>
                    {done ? 'Read' : isNext ? `${article.minutes} min · up next` : `${article.minutes} min`}
                  </Text>
                </View>
              </AnimatedPressable>
            )
          })}
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>Going deeper</Text>
        <View style={styles.tiles}>
          {deeper.map((article) => {
            const done = read.has(article.slug)
            return (
              <AnimatedPressable
                key={article.slug}
                onPress={() => router.push(`/explore/learn/${article.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={article.title}
                accessibilityHint={done ? 'Read' : `${article.minutes} min`}
                pressScale={0.97}
                style={styles.tile}
              >
                <View
                  style={[styles.tileIcon, done && styles.tileIconRead]}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                  testID={`learn-node-${done ? 'check' : 'icon'}-${article.slug}`}
                >
                  <Ionicons name={done ? 'checkmark' : (DEEPER_ICON[article.slug] ?? 'book-outline')} size={20} color={theme.colors.ink} />
                </View>
                <Text style={styles.tileTitle}>{article.title}</Text>
                <Text style={styles.rowSub}>{done ? 'Read' : `${article.minutes} min`}</Text>
              </AnimatedPressable>
            )
          })}
        </View>

        <AnimatedPressable
          onPress={() => router.push('/guides')}
          accessibilityRole="button"
          accessibilityLabel="Ready to build something? Open Guides"
          pressScale={0.985}
          style={styles.toGuides}
        >
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Ready to build something?</Text>
            <Text style={styles.rowSub}>Guides have the step-by-step for one toy or switch.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.primaryDeep} />
        </AnimatedPressable>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(8) },
  flex: { flex: 1 },
  onColor: { color: theme.colors.onColor },
  muted: { color: theme.colors.muted },
  courseTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.display, color: theme.colors.text, marginBottom: theme.spacing(2) },
  intro: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.muted, marginBottom: theme.spacing(5) },
  upNext: { gap: theme.spacing(3), padding: theme.spacing(5), borderRadius: theme.radii.card, backgroundColor: theme.colors.accentLight, marginBottom: theme.spacing(6), ...theme.shadow(2) },
  upNextLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  upNextTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.text },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface },
  segmentRead: { backgroundColor: theme.colors.primary },
  upNextFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upNextCount: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  keepReading: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: theme.spacing(4), borderRadius: theme.radii.pill, backgroundColor: theme.colors.inverse },
  keepReadingText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.onInverse },
  allRead: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, textAlign: 'center', marginBottom: theme.spacing(6) },
  sectionTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.text, marginBottom: theme.spacing(3) },
  path: { marginBottom: theme.spacing(6) },
  pathRow: { flexDirection: 'row', gap: theme.spacing(4) },
  rail: { width: 36, alignItems: 'center' },
  node: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSunken },
  nodeRead: { backgroundColor: theme.colors.success },
  nodeNext: { backgroundColor: theme.colors.primary },
  nodeText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  line: { flex: 1, width: 3, minHeight: 20, backgroundColor: theme.colors.surfaceSunken },
  lineRead: { backgroundColor: theme.colors.success },
  pathText: { flex: 1, gap: 2, paddingTop: 6, paddingBottom: theme.spacing(5) },
  pathTextLast: { paddingBottom: 0 },
  rowTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.text },
  rowSub: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  tiles: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(6) },
  tile: { flex: 1, gap: theme.spacing(2), padding: theme.spacing(3), borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  tileIcon: { width: 40, height: 40, borderRadius: theme.radii.field, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.honeySoft },
  tileIconRead: { backgroundColor: theme.colors.mintSoft },
  tileTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.text },
  toGuides: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(5), borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
})

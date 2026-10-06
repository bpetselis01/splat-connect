// The board's article (spec 2026-10-06 round 2): one idea per heading, a
// callout for the thing people get wrong, a list that jumps to each heading,
// a reading bar that fills as you scroll, and the next article pinned below.
// Reaching for Next is finishing the article, so it marks it read.
import { useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../../lib/theme'
import { useLearnProgress } from '../../lib/learn'
import { LEARN_ARTICLES } from '../../lib/learn-content'
import { Screen } from '../ui/Screen'
import { ToBeCompleted } from '../ui/ToBeCompleted'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'

export function ArticleScreen({ slug }: { slug: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { markRead } = useLearnProgress()
  const scroller = useRef<ScrollView>(null)
  const [sectionY, setSectionY] = useState<Record<string, number>>({})
  const [read, setRead] = useState(0)
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
  const finish = () => {
    markRead(slug)
    if (next) router.replace(`/explore/learn/${next.slug}`)
    else router.back()
  }
  const jump = (heading: string) => scroller.current?.scrollTo({ y: Math.max((sectionY[heading] ?? 0) - theme.spacing(3), 0), animated: true })

  // PENDING(learn-article-hero): a hero image above the first heading — articles store none, so the slot says To be completed.
  return (
    <Screen style={styles.screen}>
      {/* The layout registers a static "Guide" fallback; this overrides it
          with the real title once the article is known. */}
      <Stack.Screen options={{ title: article.title }} />
      <View
        style={styles.bar}
        accessibilityRole="progressbar"
        accessibilityLabel="Reading progress"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(read * 100) }}
      >
        <View style={[styles.barFill, { width: `${read * 100}%` }]} />
      </View>
      <ScrollView
        ref={scroller}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
          const room = contentSize.height - layoutMeasurement.height
          setRead(room > 0 ? Math.min(Math.max(contentOffset.y / room, 0), 1) : 1)
        }}
      >
        <ToBeCompleted compact icon="image-outline">A picture for this article will appear here.</ToBeCompleted>
        <Text style={styles.place}>{`Learn · ${index + 1} of ${LEARN_ARTICLES.length}`}</Text>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.intro}>{article.intro}</Text>

        {article.sections.length > 1 ? (
          <View style={styles.contents}>
            <Text style={styles.contentsLabel}>In this article</Text>
            {article.sections.map((section) => (
              <Pressable
                key={section.heading}
                onPress={() => jump(section.heading)}
                accessibilityRole="link"
                accessibilityLabel={`Go to ${section.heading}`}
                style={styles.contentsRow}
              >
                <Text style={styles.contentsText}>{section.heading}</Text>
                <Ionicons name="arrow-down" size={16} color={theme.colors.primaryDeep} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {article.sections.map((section) => (
          <View
            key={section.heading}
            style={styles.section}
            onLayout={(e) => {
              const y = e.nativeEvent.layout.y
              setSectionY((prev) => (prev[section.heading] === y ? prev : { ...prev, [section.heading]: y }))
            }}
          >
            <Text accessibilityRole="header" style={styles.heading}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, i) => (
              <Text key={i} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
            {section.callout ? (
              <View testID="article-callout" style={styles.callout}>
                <Ionicons name="bulb-outline" size={20} color={theme.colors.ink} />
                <View style={styles.flex}>
                  <Text style={styles.calloutLabel}>Worth remembering</Text>
                  <Text style={styles.calloutText}>{section.callout}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, theme.spacing(3)) }]}>
        <AnimatedPressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel={next ? `Next: ${next.title}` : 'Back to Learn'}
          pressScale={0.985}
          style={styles.next}
        >
          <View style={styles.flex}>
            <Text style={styles.nextLabel}>{next ? `Next · ${next.minutes} min` : 'All read'}</Text>
            <Text style={styles.nextTitle} numberOfLines={1}>{next ? next.title : 'Back to Learn'}</Text>
          </View>
          <View style={styles.nextArrow}>
            <Ionicons name={next ? 'arrow-forward' : 'checkmark'} size={22} color={theme.colors.primaryDeep} />
          </View>
        </AnimatedPressable>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { paddingTop: 0 },
  flex: { flex: 1 },
  bar: { height: 4, marginHorizontal: -theme.spacing(4), backgroundColor: theme.colors.surfaceSunken },
  barFill: { height: '100%', backgroundColor: theme.colors.primary },
  content: { paddingTop: theme.spacing(4), paddingBottom: theme.spacing(8) },
  place: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.muted, marginTop: theme.spacing(4) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.display, color: theme.colors.text, marginTop: theme.spacing(1) },
  intro: { fontFamily: theme.fonts.regular, fontSize: theme.type.heading, color: theme.colors.text, marginTop: theme.spacing(3), marginBottom: theme.spacing(5) },
  contents: { gap: 2, padding: theme.spacing(5), borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, marginBottom: theme.spacing(6) },
  contentsLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.muted, marginBottom: theme.spacing(1) },
  contentsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  contentsText: { flex: 1, fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.primaryDeep },
  section: { marginBottom: theme.spacing(6), gap: theme.spacing(3) },
  heading: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.text },
  paragraph: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.text },
  callout: { flexDirection: 'row', gap: theme.spacing(3), padding: theme.spacing(5), borderRadius: theme.radii.panel, backgroundColor: theme.colors.accentLight },
  calloutLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.primaryDeep, marginBottom: theme.spacing(1) },
  calloutText: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  foot: { marginHorizontal: -theme.spacing(4), paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  next: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), minHeight: 64, paddingLeft: theme.spacing(5), paddingRight: theme.spacing(2), borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentLight },
  nextLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  nextTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.text },
  nextArrow: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
})

// packages/mobile/components/explore/about-screen.tsx
// Title comes from the native header (app/(tabs)/explore/_layout.tsx), so
// this doesn't repeat it — same convention as toy-detail-screen.tsx.
import { View, Text, Image, ScrollView, Linking, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Section } from '../ui/Section'
import { AnimatedPressable } from '../ui/AnimatedPressable'

function openWebPage(path: string) {
  Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}${path}`)
}

function LinkRow({ label, hint, path }: { label: string; hint?: string; path: string }) {
  return (
    <AnimatedPressable
      onPress={() => openWebPage(path)}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      pressScale={0.99}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
    </AnimatedPressable>
  )
}

export function AboutScreen() {
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card variant="feature" style={styles.feature}>
          <Image source={require('../../assets/splat-logo.png')} style={styles.mark} resizeMode="contain" />
          <Text style={styles.tagline}>
            Free, open guides and a toy library for adapting toys — built by families, makers and
            therapists.
          </Text>
        </Card>

        <Section title="Team · Partners · Support">
          <LinkRow label="Our team" path="/about/team" />
          <LinkRow label="Partners and supporters" path="/about/partners" />
          <LinkRow label="Support SPLAT" path="/about/support" />
        </Section>

        <Section title="Which one are you?">
          <LinkRow label="Families" path="/get-involved/families" />
          <LinkRow label="Contributors" path="/get-involved/contributors" />
          <LinkRow label="Organisations" path="/get-involved/organisations" />
        </Section>

        <Section>
          <LinkRow label="Impact" hint="Events, map and what this community has made." path="/impact" />
          <LinkRow label="Contact" path="/contact" />
          <LinkRow label="Safety" path="/safety" />
        </Section>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  feature: { alignItems: 'center', marginBottom: theme.spacing(6) },
  mark: { width: 56, height: 56, marginBottom: theme.spacing(3) },
  tagline: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.label,
    color: theme.colors.primaryDeep,
    textAlign: 'center',
    lineHeight: 21,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(3),
  },
  rowText: { flex: 1, paddingRight: theme.spacing(2) },
  rowLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  rowHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
    lineHeight: 17,
  },
})

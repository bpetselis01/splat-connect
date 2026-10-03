// packages/mobile/components/explore/about-screen.tsx
// Title comes from the native header (app/(tabs)/explore/_layout.tsx), so
// this doesn't repeat it — same convention as toy-detail-screen.tsx.
import { View, Text, Image, ScrollView, Linking, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ABOUT_LEAD, ABOUT_PILLARS, ABOUT_TEAM_BLURB, CONTACT_TIMES } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
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

const CONTACT_HINT = CONTACT_TIMES.map((e) => `${e.k}: ${e.v.toLowerCase()}`).join(' · ')

export function AboutScreen() {
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Image source={require('../../assets/splat-logo.png')} style={styles.mark} resizeMode="contain" />
        <Text style={styles.lead}>{ABOUT_LEAD}</Text>

        <Section>
          {ABOUT_PILLARS.map((p) => (
            <View key={p.t} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{p.t}</Text>
                <Text style={styles.rowHint}>{p.d}</Text>
              </View>
            </View>
          ))}
          {/* PENDING(team-page): the board's "Eight people, all doing something else for a living" waits on the team's real names and roles. */}
          <LinkRow label="Our team" hint={ABOUT_TEAM_BLURB} path="/about/team" />
          <LinkRow label="Contact" hint={CONTACT_HINT} path="/contact" />
        </Section>

        <Section title="Partners · Support">
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
          <LinkRow label="Safety" path="/safety" />
        </Section>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  mark: { width: 56, height: 56, alignSelf: 'center', marginBottom: theme.spacing(3) },
  lead: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 22,
    marginBottom: theme.spacing(6),
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

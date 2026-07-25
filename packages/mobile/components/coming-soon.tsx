// packages/mobile/components/coming-soon.tsx
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../lib/theme'
import { Screen } from './ui/Screen'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { ScreenHeader } from './ui/ScreenHeader'

/**
 * Placeholder for a tab whose feature has not shipped.
 *
 * These are three of the app's five tabs, so a bare "coming soon" sentence was
 * most of what a new parent saw. It now explains what the feature will do and
 * routes to the part of the app that already works, rather than dead-ending.
 */
export function ComingSoon({
  label,
  description,
  steps,
  icon = 'construct-outline',
}: {
  label: string
  description?: string
  steps?: string[]
  icon?: keyof typeof Ionicons.glyphMap
}) {
  const router = useRouter()

  return (
    <Screen>
      <ScreenHeader title={label} showLogo />

      <Card variant="feature" style={styles.hero}>
        <View style={styles.badge}>
          <Ionicons name={icon} size={30} color={theme.colors.primary} />
        </View>
        {/* Exact wording is pinned by the unit test — keep the sentence intact. */}
        <Text style={styles.title}>{label} is coming soon.</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </Card>

      {steps?.length ? (
        <View style={styles.steps}>
          <Text style={styles.stepsTitle}>How it will work</Text>
          {steps.map((step, i) => (
            <View key={step} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerHint}>In the meantime, the tutorial library is ready to use.</Text>
        {/*
          Primary, not secondary: the secondary fill is close enough to the
          canvas that it stopped reading as a button, and this is the only
          way forward on a screen with nothing else to do.
        */}
        <Button label="Browse tutorials" onPress={() => router.push('/home')} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: theme.spacing(6) },
  badge: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(4),
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    textAlign: 'center',
  },
  description: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.primaryDeep,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: theme.spacing(2),
    maxWidth: 320,
  },
  steps: { marginTop: theme.spacing(6) },
  stepsTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing(4),
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), marginBottom: theme.spacing(4) },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
  },
  stepText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 20,
  },
  footer: { marginTop: 'auto', paddingBottom: theme.spacing(4) },
  footerHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing(3),
  },
})

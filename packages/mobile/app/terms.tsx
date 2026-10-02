// The web board's contributor-terms gate on a phone. use-auth-gate sends any
// account without a contributor_terms row here — in practice a new Apple,
// Google or code account, which skipped the sign-up form's checkbox. It sits at
// the root, outside every gated group, so it is the one signed-in screen the
// terms check does not guard.
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuth } from '../lib/auth-context'
import { useAuthGate } from '../lib/use-auth-gate'
import { theme } from '../lib/theme'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'
import { AuthError, AuthStage, Heading, Lede, TextLink, pill } from '../components/auth/parts'
import type { AuthProblem } from '../lib/auth-errors'
import { Ionicons } from '@expo/vector-icons'

// The board's copy (SPLAT Connect - Web.dc.html, termsBlocks).
const TERMS = [
  {
    h: 'You wrote it, or you have permission',
    b: "Submit only work you did yourself. Photos must be yours. If you are writing up somebody else's design, say so and link them.",
  },
  {
    h: 'You keep the copyright',
    b: 'Your guide stays yours. You grant SPLAT a non-exclusive licence to publish it and keep it available after you leave, so a family part-way through a build does not lose the instructions.',
  },
  {
    h: 'Review is not approval of safety',
    b: 'A reviewer checks that the guide is complete, followable and free of obvious hazards. That is a competence check, not a certification.',
  },
  {
    h: 'No claims about outcomes',
    b: 'Describe what the adaptation does. Do not claim a therapeutic result for any condition — this one is absolute.',
  },
  {
    h: 'Withdrawal',
    b: 'You can ask for a guide to be unpublished at any time. We may also unpublish it ourselves if a safety problem is reported, and we will tell you why.',
  },
]

export default function TermsGate() {
  const gate = useAuthGate(false)
  const { profile, pendingName, hasContributorTerms, acceptContributorTerms, setProfileName, signOut } = useAuth()
  const needsName = !profile?.name
  const [name, setName] = useState(pendingName ?? '')
  const [ticked, setTicked] = useState(false)
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)

  if (gate === 'loading') return null
  if (gate !== 'ok') return <Redirect href={gate} />
  if (hasContributorTerms) return <Redirect href="/home" />

  async function accept() {
    setError(null)
    if (needsName && !name.trim()) return setError({ kind: 'other', message: 'Add your name so people know who made your guides.' })
    setBusy(true)
    if (needsName) {
      const saved = await setProfileName(name.trim())
      if (saved.problem) {
        setBusy(false)
        return setError(saved.problem)
      }
    }
    const res = await acceptContributorTerms()
    setBusy(false)
    // Success flips hasContributorTerms, and the redirect above takes over.
    if (res.error) setError({ kind: 'other', message: res.error })
  }

  return (
    <AuthStage back={false}>
      <Text style={styles.eyebrow}>One step before you start</Text>
      <Heading>Contributor terms</Heading>
      <Lede>You keep the copyright on everything you write.</Lede>
      {needsName ? (
        <TextField
          label="Your name"
          accessibilityLabel="Your name"
          placeholder="How should we greet you?"
          textContentType="name"
          autoComplete="name"
          value={name}
          onChangeText={setName}
        />
      ) : null}
      <View style={styles.terms}>
        {TERMS.map((t) => (
          <View key={t.h} style={styles.block}>
            <Text style={styles.blockHeading}>{t.h}</Text>
            <Text style={styles.blockBody}>{t.b}</Text>
          </View>
        ))}
      </View>
      <Pressable
        testID="accept-contributor-terms"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ticked }}
        onPress={() => setTicked((v) => !v)}
        style={styles.check}
      >
        <Ionicons name={ticked ? 'checkbox' : 'square-outline'} size={24} color={theme.colors.primaryDark} />
        <Text style={styles.checkText}>I have read and accept the contributor terms.</Text>
      </Pressable>
      <AuthError error={error} />
      <Button testID="accept-terms" label="Accept and continue" style={pill} onPress={accept} disabled={!ticked} loading={busy} />
      {/* The only way out: every other route sends this account back here. */}
      <TextLink label="Sign out" onPress={() => void signOut()} />
    </AuthStage>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  terms: {
    gap: theme.spacing(4),
    padding: theme.spacing(4.5),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  block: { gap: theme.spacing(1) },
  blockHeading: { fontFamily: theme.fonts.display, fontSize: 16, color: theme.colors.ink },
  blockBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.muted },
  check: { flexDirection: 'row', gap: theme.spacing(2.5), alignItems: 'flex-start' },
  checkText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.ink },
})

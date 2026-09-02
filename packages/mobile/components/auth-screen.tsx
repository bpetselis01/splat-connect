// packages/mobile/components/auth-screen.tsx
//
// The phone's half of the auth gate, composed to match web's /login and
// /signup (packages/web/components/auth-shell.tsx). Both platforms already ran
// the same pixel tokens — 2px ink borders, hard offset shadows, the 6px radius
// — so what was actually missing was web's composition: the centred wordmark,
// the segmented switch, and the copy that goes with them.
//
// Web models the two screens as two routes because /login and /signup each
// carry ?next= and their own e2e specs. There is no ?next= on the phone, so the
// switch drives the local `mode` flag this file already had rather than two
// expo-router screens; a visitor cannot tell the difference.
import { useState } from 'react'
import {
  ScrollView,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/auth-context'
import { theme } from '../lib/theme'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { Card } from './ui/Card'
import { TextField } from './ui/TextField'

// Same base URL + pattern as the "Open Web Dashboard" link on the signed-in
// profile screen (Linking.openURL against EXPO_PUBLIC_WEB_URL). The terms
// document itself lives on web only.
export function openContributorTerms() {
  Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/legal/contributor-terms`)
}

export function TermsCheckbox({ testID, checked, onPress }: {
  testID: string
  checked: boolean
  onPress: () => void
}) {
  return (
    <View>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.termsRow}
      >
        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={theme.colors.primary} />
        {/* Web's wording, which flips rather than staying imperative once the box
            is ticked — the row then reads as a statement of fact. */}
        <Text style={styles.termsText}>
          {checked ? 'Contributor terms accepted' : 'Read and accept the contributor terms'}
        </Text>
      </Pressable>

      {/* The link is a sibling of the toggle, not a Text nested inside it.
          Nested, it sat under the row's centre point once the copy shortened,
          so a tap aimed at the checkbox opened the browser instead — the box
          never ticked and the submit button stayed disabled. A unit test cannot
          see this (fireEvent.press targets an element, not a coordinate); only
          the e2e, which clicks the centre, caught it. */}
      <Pressable
        accessibilityRole="link"
        onPress={openContributorTerms}
        style={styles.termsLinkRow}
        hitSlop={6}
      >
        <Text style={styles.termsLink}>Read the terms</Text>
      </Pressable>
    </View>
  )
}

export function ErrorRow({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
      <Text style={styles.error}>{message}</Text>
    </View>
  )
}

/**
 * The wordmark web draws in place of a header — the nav is suppressed on an auth
 * gate, which otherwise leaves the visitor on a page that never says which site
 * they are on.
 *
 * Not ScreenHeader: that one is left-aligned and sized for a screen title, and
 * twenty other screens depend on it being exactly that. This is the auth gate's
 * own, centred and at web's 18px.
 */
function Wordmark() {
  return (
    <View style={styles.wordmark}>
      <View style={styles.logoTile}>
        <Image
          source={require('../assets/splat-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.brandName}>SPLAT Connect</Text>
    </View>
  )
}

/**
 * Web's `.auth-switch`: one border and one shadow around the pair, with the
 * divider drawn as a border on the second tab, so it reads as a single control
 * rather than two adjacent buttons.
 *
 * The tabs are `flex: 1` inside a stretched row rather than hugging their text.
 * Web can let them hug because a desktop viewport always has room; a 320pt
 * phone does not, and "Create account" set in uppercase with tracking is wide
 * enough to clip. Equal halves of whatever width the phone gives always fit.
 *
 * Two nested views because iOS drops a shadow on a view that also clips its
 * children: the outer one carries the shadow, the inner one the clip.
 */
function AuthSwitch({ current, onSelect }: {
  current: 'signin' | 'signup'
  onSelect: (mode: 'signin' | 'signup') => void
}) {
  return (
    <View style={styles.switchShadow}>
      <View style={styles.switchClip}>
        {(['signin', 'signup'] as const).map((tab, i) => {
          const selected = current === tab
          return (
            <Pressable
              key={tab}
              testID={`auth-tab-${tab}`}
              onPress={() => onSelect(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, i > 0 && styles.tabDivider, selected && styles.tabOn]}
            >
              {/* Uppercased in style, not in the string, so a screen reader is
                  handed "Sign in" rather than something it may spell out. */}
              <Text numberOfLines={1} style={[styles.tabText, selected && styles.tabTextOn]}>
                {tab === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup' | 'check-email'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isSignUp = mode === 'signup'

  function select(next: 'signin' | 'signup') {
    setMode(next)
    setError(null)
    setConfirmPassword('')
  }

  async function handleSubmit() {
    setError(null)
    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      if (!isSignUp) {
        const res = await signIn(email, password)
        if (res.error === 'Email not confirmed') {
          setError('Please confirm your email before signing in — check your inbox for the confirmation link.')
        } else if (res.error) {
          setError(res.error)
        }
        return
      }
      const res = await signUp(email, password, name)
      if (res.error) {
        setError(res.error)
        return
      }
      setMode('check-email')
      setName('')
      setPassword('')
      setConfirmPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  // The chrome is identical on all three states, check-your-email included —
  // web keeps AuthShell around its success card for the same reason: the
  // wordmark and the way back out should not vanish at the one moment the
  // visitor is waiting on an email that may never arrive.
  const chrome = (body: React.ReactNode) => (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* flexGrow + centre, so the card sits mid-screen on a tall phone and
              scrolls rather than squashing on a short one. maxWidth is web's
              380px card cap: without it the card spans a tablet edge to edge. */}
          <View style={styles.column}>
            <Wordmark />
            <AuthSwitch current={isSignUp ? 'signup' : 'signin'} onSelect={select} />
            {body}
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  )

  if (mode === 'check-email') {
    return chrome(
      <Card style={styles.panel}>
        <View style={styles.confirmBadge}>
          <Ionicons name="mail-unread-outline" size={26} color={theme.colors.primary} />
        </View>
        <Text style={styles.heading}>Check your email</Text>
        <Text style={styles.checkEmailText}>
          We&apos;ve sent a confirmation link to {email}. Confirm your email, then sign in.
        </Text>
        <Button
          label="Back to sign in"
          variant="accent"
          style={styles.backButton}
          onPress={() => select('signin')}
        />
      </Card>
    )
  }

  return chrome(
    <Card style={styles.card}>
      <Text style={styles.heading}>{isSignUp ? 'Create your account' : 'Sign in'}</Text>
      {isSignUp ? (
        <Text style={styles.subhead}>
          One account for everything — browse, contribute, and manage your child&apos;s profile.
        </Text>
      ) : null}

      {isSignUp ? (
        <TextField
          label="Full name"
          accessibilityLabel="Full name"
          value={name}
          onChangeText={setName}
        />
      ) : null}

      <TextField
        // testID so E2E can target the input directly; the label is a sibling
        // Text, which isn't focusable.
        testID="email-input"
        label="Email"
        accessibilityLabel="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextField
        testID="password-input"
        label="Password"
        accessibilityLabel="Password"
        // TextField draws its hint between the label and the box; web sets the
        // same sentence below the input. Reusing the prop beats a fourth
        // spacing rule for one line of eight words.
        hint={isSignUp ? 'At least 6 characters.' : undefined}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {isSignUp ? (
        <TextField
          label="Confirm password"
          accessibilityLabel="Confirm password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      ) : null}

      {isSignUp ? (
        <TermsCheckbox
          testID="accept-contributor-terms"
          checked={acceptedTerms}
          onPress={() => setAcceptedTerms((v) => !v)}
        />
      ) : null}

      <ErrorRow message={error} />

      {/* Disabled until the box is ticked, as web has it, rather than accepting
          the press and answering with an error the visitor then has to read. */}
      <Button
        testID="auth-submit"
        label={isSignUp ? 'Create account' : 'Sign in'}
        variant="accent"
        onPress={handleSubmit}
        disabled={isSignUp && !acceptedTerms}
        loading={submitting}
      />

      {/* Inside the card, as web has it — floating below left the card ending
          on a button with no way out. */}
      <Pressable
        accessibilityRole="link"
        onPress={() => select(isSignUp ? 'signin' : 'signup')}
      >
        <Text style={styles.crossLink}>
          {isSignUp ? 'Already have an account? ' : 'New here? '}
          <Text style={styles.crossLinkStrong}>{isSignUp ? 'Sign in' : 'Create an account'}</Text>
        </Text>
      </Pressable>
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: theme.spacing(8),
  },
  column: { width: '100%', maxWidth: 380, alignSelf: 'center' },

  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2.5),
    marginBottom: theme.spacing(6),
  },
  logoTile: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentLight,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
  },
  logo: { width: 20, height: 20 },
  brandName: {
    fontFamily: theme.fonts.black,
    fontSize: 18,
    color: theme.colors.ink,
    letterSpacing: -0.4,
  },

  switchShadow: {
    alignSelf: 'stretch',
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing(5),
    ...theme.shadow(4),
  },
  switchClip: {
    flexDirection: 'row',
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing(2),
  },
  tabDivider: { borderLeftWidth: theme.border.thin, borderLeftColor: theme.colors.ink },
  tabOn: { backgroundColor: theme.colors.ink },
  tabText: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    // Web sets these labels in IBM Plex Mono. The phone loads Nunito and
    // Jersey 10 only, and a fourth family for two words is not worth the
    // bundle; Nunito Black uppercase at web's 0.05em tracking is the match.
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.ink,
  },
  tabTextOn: { color: '#ffffff' },

  card: { padding: theme.spacing(6) },
  panel: { alignItems: 'center', padding: theme.spacing(6) },
  confirmBadge: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(4),
  },
  heading: {
    fontFamily: theme.fonts.black,
    // Web's auth heading is 22px — a step below theme.type.title, which is the
    // size a screen title takes when it is the only thing above the fold.
    fontSize: 22,
    color: theme.colors.text,
    marginBottom: theme.spacing(4),
  },
  subhead: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 20,
    marginTop: -theme.spacing(2),
    marginBottom: theme.spacing(4),
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    backgroundColor: theme.colors.apricotSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  error: {
    flex: 1,
    color: theme.colors.danger,
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    lineHeight: 18,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  termsLinkRow: { marginLeft: theme.spacing(8), marginTop: theme.spacing(1), marginBottom: theme.spacing(3) },
  termsText: { flex: 1, color: theme.colors.muted, fontFamily: theme.fonts.regular },
  termsLink: { color: theme.colors.primaryDark, fontFamily: theme.fonts.semiBold, textDecorationLine: 'underline' },
  checkEmailText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  backButton: { alignSelf: 'stretch', marginTop: theme.spacing(5) },
  crossLink: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: theme.spacing(4),
  },
  crossLinkStrong: { fontFamily: theme.fonts.bold, color: theme.colors.primaryDark },
})

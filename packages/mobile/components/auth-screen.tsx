// packages/mobile/components/auth-screen.tsx
import { useState } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/auth-context'
import { theme } from '../lib/theme'
import { ScreenHeader } from './ui/ScreenHeader'
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
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.termsRow}
    >
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={theme.colors.primary} />
      <Text style={styles.termsText}>
        I have read and accept the{' '}
        <Text onPress={openContributorTerms} style={styles.termsLink}>
          contributor terms
        </Text>
        .
      </Text>
    </Pressable>
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

  async function handleSubmit() {
    setError(null)
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (mode === 'signup' && !acceptedTerms) {
      setError('Please accept the contributor terms to create an account.')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'signin') {
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

  if (mode === 'check-email') {
    return (
      <Screen>
        <ScreenHeader title="SPLAT Connect" showLogo />
        <Card style={styles.panel}>
          <View style={styles.confirmBadge}>
            <Ionicons name="mail-unread-outline" size={26} color={theme.colors.primary} />
          </View>
          <Text style={styles.heading}>Check Your Email</Text>
          <Text style={styles.checkEmailText}>
            We&apos;ve sent a confirmation link to {email}. Confirm your email, then sign in below.
          </Text>
          <Pressable onPress={() => { setMode('signin'); setError(null) }}>
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScreenHeader title="SPLAT Connect" showLogo />

        <Card>
          <Text style={styles.heading}>{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</Text>

          {mode === 'signup' ? (
            <TextField
              label="Name"
              placeholder="Name"
              accessibilityLabel="Name"
              value={name}
              onChangeText={setName}
            />
          ) : null}

          <TextField
            // testID so E2E can target the input directly; "Email" also
            // matches the sibling label Text, which isn't focusable.
            testID="email-input"
            label="Email"
            placeholder="Email"
            accessibilityLabel="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextField
            testID="password-input"
            label="Password"
            placeholder="Password"
            accessibilityLabel="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {mode === 'signup' ? (
            <TextField
              label="Confirm Password"
              placeholder="Confirm Password"
              accessibilityLabel="Confirm Password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          ) : null}

          {mode === 'signup' ? (
            <TermsCheckbox
              testID="accept-contributor-terms"
              checked={acceptedTerms}
              onPress={() => setAcceptedTerms((v) => !v)}
            />
          ) : null}

          <ErrorRow message={error} />

          <Button
            label={mode === 'signin' ? 'Sign In' : 'Sign Up'}
            onPress={handleSubmit}
            loading={submitting}
          />
        </Card>

        <Pressable
          onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setConfirmPassword('') }}
        >
          <Text style={styles.link}>
            {mode === 'signin' ? 'Create an account' : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(8) },
  panel: { alignItems: 'center' },
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
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.title,
    color: theme.colors.text,
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
    marginBottom: theme.spacing(3),
  },
  termsText: { flex: 1, color: theme.colors.muted, fontFamily: theme.fonts.regular },
  termsLink: { color: theme.colors.primaryDark, fontFamily: theme.fonts.semiBold, textDecorationLine: 'underline' },
  checkEmailText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  link: {
    color: theme.colors.primaryDark,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    textAlign: 'center',
    marginTop: theme.spacing(4),
  },
})

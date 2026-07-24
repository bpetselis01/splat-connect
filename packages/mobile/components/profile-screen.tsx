// packages/mobile/components/profile-screen.tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, Linking } from 'react-native'
import { useAuth } from '../lib/auth-context'
import { theme } from '../lib/theme'
import { ScreenHeader } from './ui/ScreenHeader'
import { Button } from './ui/Button'

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function ProfileScreen() {
  const { session, profile, signIn, signUp, signOut } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup' | 'check-email'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
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
      <View style={styles.container}>
        <ScreenHeader title="Profile" showLogo />
        <Text style={styles.heading}>Check Your Email</Text>
        <Text style={styles.checkEmailText}>
          We&apos;ve sent a confirmation link to {email}. Confirm your email, then sign in below.
        </Text>
        <Pressable onPress={() => { setMode('signin'); setError(null) }}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </View>
    )
  }

  if (session) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Profile" showLogo />
        <Text style={styles.signedInText}>Signed in as {session.user.email}</Text>
        {profile ? (
          <>
            <Text style={styles.roleText}>{roleLabel(profile.role)}</Text>
            <Button
              label="Open Web Dashboard"
              onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/dashboard`)}
              variant="secondary"
            />
          </>
        ) : null}
        <Button label="Sign Out" onPress={() => signOut()} variant="secondary" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" showLogo />
      <Text style={styles.heading}>{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</Text>
      {mode === 'signup' ? (
        <>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Name"
            accessibilityLabel="Name"
            value={name}
            onChangeText={setName}
          />
        </>
      ) : null}
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        accessibilityLabel="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Password"
        accessibilityLabel="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {mode === 'signup' ? (
        <>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            accessibilityLabel="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={mode === 'signin' ? 'Sign In' : 'Sign Up'} onPress={handleSubmit} loading={submitting} />
      <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setConfirmPassword('') }}>
        <Text style={styles.link}>{mode === 'signin' ? 'Create an account' : 'Have an account? Sign in'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), justifyContent: 'center' },
  heading: { fontFamily: theme.fonts.bold, fontSize: 22, color: theme.colors.text, marginBottom: theme.spacing(4) },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    fontFamily: theme.fonts.regular,
  },
  label: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, marginBottom: theme.spacing(1) },
  error: { color: theme.colors.danger, fontFamily: theme.fonts.regular, marginBottom: theme.spacing(2) },
  checkEmailText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.muted, textAlign: 'center' },
  signedInText: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text, marginBottom: theme.spacing(1), textAlign: 'center' },
  roleText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.muted, marginBottom: theme.spacing(3), textAlign: 'center' },
  link: { color: theme.colors.primary, fontFamily: theme.fonts.semiBold, textAlign: 'center', marginTop: theme.spacing(3) },
})

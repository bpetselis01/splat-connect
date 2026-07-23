// packages/mobile/components/profile-screen.tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useAuth } from '../lib/auth-context'
import { theme } from '../lib/theme'
import { ScreenHeader } from './ui/ScreenHeader'
import { Button } from './ui/Button'

export function ProfileScreen() {
  const { session, signIn, signUp, signOut } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    const res = mode === 'signin' ? await signIn(email, password) : await signUp(email, password, name)
    if (res.error) setError(res.error)
  }

  if (session) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Profile" showLogo />
        <Text style={styles.signedInText}>Signed in as {session.user.email}</Text>
        <Button label="Sign Out" onPress={() => signOut()} variant="secondary" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" showLogo />
      <Text style={styles.heading}>{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</Text>
      {mode === 'signup' ? (
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={mode === 'signin' ? 'Sign In' : 'Sign Up'} onPress={handleSubmit} />
      <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}>
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
  error: { color: '#991b1b', fontFamily: theme.fonts.regular, marginBottom: theme.spacing(2) },
  signedInText: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text, marginBottom: theme.spacing(3), textAlign: 'center' },
  link: { color: theme.colors.primary, fontFamily: theme.fonts.semiBold, textAlign: 'center', marginTop: theme.spacing(3) },
})

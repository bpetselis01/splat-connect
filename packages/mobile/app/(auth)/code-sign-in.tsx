// Sign in with an emailed code: one field, keyboard already up, then the code
// screen. Replaces the "Email me a code" button that used to error on an
// empty email.
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import type { AuthProblem } from '../../lib/auth-errors'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { Mascot } from '../../components/ui/TabHero'
import { AuthStage, AuthError, Heading, Lede, TextLink, pill } from '../../components/auth/parts'

// Shape only; Supabase decides the rest and its answer maps to the same words.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function CodeSignInScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const { sendSignInCode } = useAuth()
  const [email, setEmail] = useState(params.email ?? '')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const address = email.trim()

  async function submit() {
    if (busy) return
    setError(null)
    if (!address) return setError({ kind: 'other', message: 'Add your email.' })
    if (!LOOKS_LIKE_EMAIL.test(address)) {
      return setError({ kind: 'bad-email', message: "That email address doesn't look right." })
    }
    setBusy(true)
    const res = await sendSignInCode(address)
    setBusy(false)
    if (res.problem) return setError(res.problem)
    router.push({ pathname: '/verify', params: { email: address, type: 'email' } })
  }

  return (
    <AuthStage>
      <View style={styles.bear}>
        <Mascot pose="wave" size={72} />
      </View>
      <Heading center>Sign in with a code</Heading>
      <Lede center>We'll email you a 6-digit code. No password needed.</Lede>
      <TextField
        testID="email-input"
        label="Email"
        accessibilityLabel="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoFocus
        returnKeyType="send"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={submit}
      />
      <AuthError
        error={error}
        action={
          error?.kind === 'no-account'
            ? { label: 'Create an account', onPress: () => router.replace('/create-account') }
            : undefined
        }
      />
      <Button testID="auth-submit" label="Send code" style={pill} onPress={submit} loading={busy} />
      <TextLink
        label="Use a password instead"
        onPress={() => router.replace({ pathname: '/sign-in', params: { email: address } })}
      />
    </AuthStage>
  )
}

const styles = StyleSheet.create({
  bear: { alignItems: 'center' },
})

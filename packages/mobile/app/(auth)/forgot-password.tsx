// Step one of a reset that never leaves the app. The answer is the same
// whether or not an account uses the email, so the form reveals nothing —
// only being offline or rate limited stops it.
import { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import type { AuthProblem } from '../../lib/auth-errors'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { AuthStage, AuthError, Heading, Lede, pill } from '../../components/auth/parts'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState(params.email ?? '')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    const address = email.trim()
    if (!address) return setError({ kind: 'other', message: 'Type the email you sign in with.' })
    setBusy(true)
    const res = await sendPasswordReset(address)
    setBusy(false)
    if (res.problem?.kind === 'offline' || res.problem?.kind === 'rate-limited') return setError(res.problem)
    router.push({ pathname: '/reset-password', params: { email: address } })
  }

  return (
    <AuthStage>
      <Heading>Forgot your password?</Heading>
      <Lede>We'll email you a 6-digit code. You'll choose a new password on the next screen.</Lede>
      <TextField
        testID="email-input"
        label="Email"
        accessibilityLabel="Email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={submit}
      />
      <AuthError error={error} />
      <Button testID="auth-submit" label="Send code" style={pill} onPress={submit} loading={busy} />
    </AuthStage>
  )
}

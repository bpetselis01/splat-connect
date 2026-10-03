// Step two: the emailed code and the new password together. For an account
// made with Apple, Google or a code this ADDS a password — the code already
// proves the email is theirs.
import { useState } from 'react'
import { Text } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import type { AuthProblem } from '../../lib/auth-errors'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { AuthStage, AuthError, Heading, Lede, PasswordField, TextLink, pill } from '../../components/auth/parts'
import { theme } from '../../lib/theme'

export default function ResetPasswordScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>()
  const { resetPassword, sendPasswordReset } = useAuth()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit() {
    if (busy) return
    setError(null)
    if (code.length !== 6) return setError({ kind: 'other', message: 'Type the 6-digit code from the email.' })
    // Checked before the code is spent: verifying signs you in, and the new
    // password is set after — a too-short one would be refused too late.
    if (password.length < 6) return setError({ kind: 'other', message: 'Use at least 6 characters for the password.' })
    setBusy(true)
    const res = await resetPassword(email, code, password)
    setBusy(false)
    if (res.problem) setError(res.problem)
  }

  async function again() {
    setError(null)
    const res = await sendPasswordReset(email)
    if (res.problem?.kind === 'offline' || res.problem?.kind === 'rate-limited') return setError(res.problem)
    setSent(true)
  }

  return (
    <AuthStage>
      <Heading>Choose a new password</Heading>
      <Lede>
        If an account uses <Text style={{ fontFamily: theme.fonts.black, color: theme.colors.ink }}>{email}</Text>, a
        6-digit code is on its way.
      </Lede>
      <TextField
        testID="code-input"
        label="Code"
        accessibilityLabel="6-digit code"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        style={{ fontFamily: theme.fonts.numeral, letterSpacing: 6 }}
      />
      <PasswordField label="New password" isNew value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      <AuthError error={error} />
      <Button testID="auth-submit" label="Save and sign in" style={pill} onPress={submit} loading={busy} />
      {sent ? <Lede center>Sent. Check your email.</Lede> : <TextLink lead="Didn't get it?" label="Send again" onPress={again} />}
    </AuthStage>
  )
}

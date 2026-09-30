// Sign in: the mobile board's form with Apple/Google above it, Forgot
// password on the label row, and an emailed code as the other way in.
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth, type AuthResult } from '../../lib/auth-context'
import type { AuthProblem } from '../../lib/auth-errors'
import { theme } from '../../lib/theme'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { Mascot } from '../../components/ui/TabHero'
import {
  AuthStage,
  AuthError,
  Heading,
  PasswordField,
  SocialButtons,
  TextLink,
  pill,
} from '../../components/auth/parts'

export default function SignInScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const { signIn, sendSignInCode, signInWithApple, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState(params.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState<'password' | 'code' | null>(null)
  const address = email.trim()

  async function social(run: () => Promise<AuthResult>) {
    setError(null)
    const res = await run()
    if (res.problem) setError(res.problem)
  }

  async function submit() {
    setError(null)
    if (!address || !password) return setError({ kind: 'other', message: 'Add your email and password.' })
    setBusy('password')
    const res = await signIn(address, password)
    setBusy(null)
    if (!res.problem) return
    if (res.problem.kind === 'unconfirmed') {
      return router.push({ pathname: '/verify', params: { email: address, type: 'signup' } })
    }
    if (res.problem.kind === 'credentials') setPassword('')
    setError(res.problem)
  }

  async function emailCode() {
    setError(null)
    if (!address) return setError({ kind: 'other', message: 'Type your email first, then we can send a code.' })
    setBusy('code')
    const res = await sendSignInCode(address)
    setBusy(null)
    if (res.problem) return setError(res.problem)
    router.push({ pathname: '/verify', params: { email: address, type: 'email' } })
  }

  return (
    <AuthStage>
      <View style={styles.bear}>
        <Mascot pose="wave" size={72} />
      </View>
      <Heading center>Welcome back</Heading>
      <SocialButtons onApple={() => social(signInWithApple)} onGoogle={() => social(signInWithGoogle)} />
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
        value={email}
        onChangeText={setEmail}
      />
      <View>
        <PasswordField value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        <View style={styles.forgot}>
          <TextLink
            testID="forgot-password"
            label="Forgot password?"
            onPress={() => router.push({ pathname: '/forgot-password', params: { email: address } })}
          />
        </View>
      </View>
      <AuthError
        error={error}
        action={
          error?.kind === 'no-account'
            ? { label: 'Create an account', onPress: () => router.replace('/create-account') }
            : undefined
        }
      />
      <Button testID="auth-submit" label="Sign in" style={pill} onPress={submit} loading={busy === 'password'} />
      <Button
        testID="email-code"
        label="Email me a sign-in code"
        variant="secondary"
        style={pill}
        onPress={emailCode}
        loading={busy === 'code'}
      />
      <TextLink lead="New here?" label="Create an account" onPress={() => router.replace('/create-account')} />
    </AuthStage>
  )
}

const styles = StyleSheet.create({
  bear: { alignItems: 'center' },
  forgot: { alignSelf: 'flex-end', marginTop: -theme.spacing(2) },
})

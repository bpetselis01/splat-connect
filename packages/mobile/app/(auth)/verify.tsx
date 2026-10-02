// The board's "Check your email" card as a screen you can act on: the sixth
// digit signs you in. Serves both an email + password sign-up (type=signup)
// and a code sign-in (type=email). Success needs no navigation — the session
// lands and (auth)/_layout sends it on.
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth-context'
import type { AuthProblem } from '../../lib/auth-errors'
import { theme } from '../../lib/theme'
import { Button } from '../../components/ui/Button'
import { AuthStage, CodeInput, AuthError, Heading, Lede, TextLink, pill } from '../../components/auth/parts'

const RESEND_AFTER = 60

export default function VerifyScreen() {
  const router = useRouter()
  const { email = '', type = 'signup' } = useLocalSearchParams<{ email: string; type: 'signup' | 'email' }>()
  const { verifyCode, resendSignupCode, sendSignInCode } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(RESEND_AFTER)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function check(token: string) {
    setError(null)
    setBusy(true)
    const res = await verifyCode(email, token, type)
    setBusy(false)
    if (res.problem) {
      setCode('')
      setError(res.problem)
    }
  }

  function onChange(next: string) {
    setCode(next)
    if (next.length === 6) check(next)
  }

  async function resend() {
    setError(null)
    const res = type === 'signup' ? await resendSignupCode(email) : await sendSignInCode(email)
    if (res.problem) return setError(res.problem)
    setWait(RESEND_AFTER)
  }

  return (
    <AuthStage>
      <View style={styles.badge}>
        <Ionicons name="mail-open" size={34} color={theme.colors.successDeep} />
      </View>
      <Heading center>Check your email</Heading>
      <Lede center>
        We sent a 6-digit code to{'\n'}
        <Text style={styles.email}>{email}</Text>
      </Lede>
      <CodeInput value={code} onChange={onChange} />
      <AuthError error={error} />
      {busy ? <Lede center>Checking…</Lede> : null}
      {wait > 0 ? (
        <Lede center>
          Resend code in <Text style={styles.timer}>0:{String(wait).padStart(2, '0')}</Text>
        </Lede>
      ) : (
        <TextLink testID="resend-code" label="Send a new code" onPress={resend} />
      )}
      {type === 'email' ? (
        <TextLink
          label="Wrong email? Change it"
          onPress={() => router.replace({ pathname: '/code-sign-in', params: { email } })}
        />
      ) : (
        <Button label="Use a different email" variant="secondary" style={pill} onPress={() => router.back()} />
      )}
      <Lede center>The link in the email works too. It opens SPLAT on the web.</Lede>
    </AuthStage>
  )
}

const styles = StyleSheet.create({
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: theme.colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  email: { fontFamily: theme.fonts.black, color: theme.colors.ink },
  timer: { fontFamily: theme.fonts.numeral, color: theme.colors.ink },
})

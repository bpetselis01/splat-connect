// Create account: Apple/Google above the web board's form, minus the intent
// tiles and the confirm field. An email sign-up ends on the code screen; a
// social one is signed in at once and the terms gate takes it from there.
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useAuth, type AuthResult } from '../../lib/auth-context'
import type { AuthProblem } from '@splat-connect/types'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import {
  AuthStage,
  AuthError,
  Heading,
  PasswordField,
  SocialButtons,
  TermsCheckbox,
  TextLink,
  pill,
} from '../../components/auth/parts'

export default function CreateAccountScreen() {
  const router = useRouter()
  const { signUp, signInWithApple, signInWithGoogle } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)

  async function social(run: () => Promise<AuthResult>) {
    setError(null)
    const res = await run()
    if (res.problem) setError(res.problem)
  }

  async function submit() {
    // The keyboard's return key reaches here past the disabled button.
    if (!accepted || busy) return
    setError(null)
    const address = email.trim()
    if (!name.trim() || !address) return setError({ kind: 'other', message: 'Add your name and email.' })
    if (password.length < 6) return setError({ kind: 'other', message: 'Use at least 6 characters for the password.' })
    setBusy(true)
    const res = await signUp(address, password, name.trim())
    setBusy(false)
    if (res.problem) return setError(res.problem)
    router.push({ pathname: '/verify', params: { email: address, type: 'signup' } })
  }

  return (
    <AuthStage>
      <Heading>Create your account</Heading>
      <SocialButtons onApple={() => social(signInWithApple)} onGoogle={() => social(signInWithGoogle)} />
      <TextField
        label="Your name"
        accessibilityLabel="Your name"
        placeholder="How should we greet you?"
        textContentType="name"
        autoComplete="name"
        value={name}
        onChangeText={setName}
      />
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
      <PasswordField isNew value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      <TermsCheckbox checked={accepted} onPress={() => setAccepted((v) => !v)} />
      <AuthError
        error={error}
        action={
          error?.kind === 'registered'
            ? { label: `Sign in as ${email.trim()}`, onPress: () => router.replace({ pathname: '/sign-in', params: { email: email.trim() } }) }
            : undefined
        }
      />
      {/* Off until the box is ticked, as on web, rather than accepting the
          press and answering with an error to read. */}
      <Button
        testID="auth-submit"
        label="Create my account"
        style={pill}
        onPress={submit}
        disabled={!accepted}
        loading={busy}
      />
      <TextLink lead="Have an account?" label="Sign in" onPress={() => router.replace('/sign-in')} />
    </AuthStage>
  )
}


// packages/mobile/components/account/delete-account-screen.tsx
//
// Deleting your own account (docs/superpowers/specs/2026-09-30-account-deletion-design.md):
// what will happen → type DELETE → the emailed code (or Apple's sheet) →
// DELETE /api/me → "Your account is deleted". The code step is what makes the
// session fresh enough for the API to accept the deletion.
import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth-context'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import type { AuthProblem } from '@splat-connect/types'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Mascot } from '../ui/TabHero'
import { AuthError, AuthStage, CodeInput, Heading, Lede, pill } from '../auth/parts'
import { AppleButton, appleAvailable } from '../../lib/social-auth'

export type DeletionPreview = {
  open: { id: string; type: 'donation' | 'exchange' | 'build' | 'print' | string }[]
  childProfiles: number
  publishedGuides: number
  soleLedOrgs: { id: string; name: string }[]
}

const OPEN_WORD: Record<string, [string, string]> = {
  donation: ['exchange', 'exchanges'],
  exchange: ['exchange', 'exchanges'],
  build: ['build', 'builds'],
  print: ['print job', 'print jobs'],
}

/** "2 exchanges, 1 print job" — the in-flight line, by kind. */
export function openSummary(open: DeletionPreview['open']): string {
  const counts = new Map<string, number>()
  for (const o of open) {
    const [one, many] = OPEN_WORD[o.type] ?? ['request', 'requests']
    counts.set(one + '|' + many, (counts.get(one + '|' + many) ?? 0) + 1)
  }
  return [...counts].map(([k, n]) => `${n} ${n === 1 ? k.split('|')[0] : k.split('|')[1]}`).join(', ')
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function Group({ tone, title, rows }: { tone: 'warn' | 'gone' | 'stays'; title: string; rows: string[] }) {
  const icon = tone === 'gone' ? 'close-circle' : tone === 'stays' ? 'checkmark-circle' : 'alert-circle'
  const color = tone === 'gone' ? theme.colors.danger : tone === 'stays' ? theme.colors.successDeep : theme.colors.honey
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {rows.map((r) => (
        <View key={r} style={styles.row}>
          <Ionicons name={icon} size={17} color={color} />
          <Text style={styles.rowText}>{r}</Text>
        </View>
      ))}
    </View>
  )
}

export function DeleteAccountScreen() {
  const router = useRouter()
  const { session, sendSignInCode, verifyCode, reauthWithApple, signOut } = useAuth()
  const email = session?.user.email ?? ''
  const usesApple = ((session?.user.app_metadata?.providers as string[] | undefined) ?? []).includes('apple')
  const [preview, setPreview] = useState<DeletionPreview | null>(null)
  const [keepName, setKeepName] = useState(false)
  const [typed, setTyped] = useState('')
  const [step, setStep] = useState<'review' | 'code' | 'done'>('review')
  const [code, setCode] = useState('')
  const [error, setError] = useState<AuthProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const [apple, setApple] = useState(false)
  const [emailed, setEmailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    apiClient
      .get<DeletionPreview>('/api/me/deletion')
      .then(setPreview)
      .catch(() => setError({ kind: 'other', message: 'Could not load your account. Check your connection and try again.' }))
    if (usesApple) appleAvailable().then(setApple)
  }, [usesApple, attempt])

  async function remove(appleAuthorizationCode?: string) {
    try {
      const res = await apiClient.delete<{ emailed?: boolean }>('/api/me', {
        confirm: 'DELETE',
        keepCredit: keepName,
        appleAuthorizationCode,
      })
      setEmailed(Boolean(res?.emailed))
      setStep('done')
    } catch {
      setError({ kind: 'other', message: 'Your account was not deleted. Try again in a moment.' })
    }
  }

  async function sendCode() {
    setError(null)
    setBusy(true)
    const res = await sendSignInCode(email)
    setBusy(false)
    if (res.problem) return setError(res.problem)
    setStep('code')
  }

  async function onCode(next: string) {
    setCode(next)
    if (next.length < 6) return
    setError(null)
    setBusy(true)
    const res = await verifyCode(email, next, 'email')
    if (res.problem) {
      setBusy(false)
      setCode('')
      return setError(res.problem)
    }
    await remove()
    setBusy(false)
  }

  async function withApple() {
    setError(null)
    const res = await reauthWithApple()
    if (res.cancelled) return
    if (res.problem) return setError(res.problem)
    setBusy(true)
    await remove(res.authorizationCode)
    setBusy(false)
  }

  if (step === 'done') {
    return (
      <AuthStage back={false}>
        <View style={styles.center}>
          <Mascot pose="wave" size={110} />
        </View>
        <Heading center>Your account is deleted</Heading>
        <Lede center>Everything listed is gone now. Guides you published stay up for the families using them.</Lede>
        {emailed ? <Lede center>We emailed a confirmation to {email}.</Lede> : null}
        <Button testID="deleted-done" label="Done" style={pill} onPress={() => void signOut()} />
      </AuthStage>
    )
  }

  if (step === 'code') {
    return (
      <AuthStage foot={false}>
        <Heading center>Enter the code to delete</Heading>
        <Lede center>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.strong}>{email}</Text>
        </Lede>
        <CodeInput value={code} onChange={onCode} />
        <AuthError error={error} />
        <Lede center>{busy ? 'Deleting…' : "The sixth digit deletes the account. This can't be undone."}</Lede>
        <Button label="Keep my account" variant="secondary" style={pill} onPress={() => router.back()} />
      </AuthStage>
    )
  }

  if (!preview) {
    return (
      <AuthStage foot={false}>
        <Heading>Delete your account</Heading>
        {error ? <AuthError error={error} /> : <Lede>Loading…</Lede>}
        {error ? (
          <Button label="Try again" variant="secondary" style={pill} onPress={() => { setError(null); setAttempt((n) => n + 1) }} />
        ) : null}
      </AuthStage>
    )
  }

  if (preview.soleLedOrgs.length) {
    const names = preview.soleLedOrgs.map((o) => o.name).join(', ')
    return (
      <AuthStage foot={false}>
        <Heading>Delete your account</Heading>
        <AuthError
          error={{
            kind: 'other',
            message: `You're the only leader of ${names}. Invite another leader first, so the organisation can still answer families.`,
          }}
        />
        <Button testID="manage-leaders" label="Manage leaders" style={pill} onPress={() => router.push('/organisation/profile')} />
      </AuthStage>
    )
  }

  const deleted = [
    'Your profile, email and sign-in',
    ...(preview.childProfiles ? [plural(preview.childProfiles, 'child profile', 'child profiles')] : []),
    'Drafts, saves, photos and pickup address',
  ]
  const stays = [
    ...(preview.publishedGuides ? [plural(preview.publishedGuides, 'published guide', 'published guides')] : []),
    "Other people's exchanges and messages with you",
  ]

  return (
    <AuthStage foot={false}>
      <Heading>Delete your account</Heading>
      {preview.open.length ? (
        <Group
          tone="warn"
          title="Open right now"
          rows={[`${openSummary(preview.open)} in progress`, 'These will be cancelled and the other person told.']}
        />
      ) : null}
      <Group tone="gone" title="Deleted now" rows={deleted} />
      <Group tone="stays" title="Stays, without your name" rows={stays} />
      {preview.publishedGuides ? (
        <Pressable
          testID="keep-name"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: keepName }}
          onPress={() => setKeepName((v) => !v)}
          style={styles.check}
        >
          <Ionicons name={keepName ? 'checkbox' : 'square-outline'} size={24} color={theme.colors.primaryDark} />
          <Text style={styles.checkText}>Keep my name on my published guides</Text>
        </Pressable>
      ) : null}
      <TextField
        testID="type-delete"
        label="Type DELETE to continue"
        accessibilityLabel="Type DELETE to continue"
        autoCapitalize="characters"
        autoCorrect={false}
        value={typed}
        onChangeText={setTyped}
      />
      <AuthError error={error} />
      <Button
        testID="delete-send-code"
        label="Email me a code"
        style={[pill, styles.danger]}
        disabled={typed.trim() !== 'DELETE'}
        loading={busy}
        onPress={sendCode}
      />
      {/* PENDING(apple-revoke): shows only for accounts signed in with Apple, which
          cannot exist until apple-sign-in ships. The code it returns is revoked
          by the API once its Apple key is configured (packages/api/src/apple-revoke.ts). */}
      {apple && Platform.OS === 'ios' && typed.trim() === 'DELETE' ? (
        <AppleButton onPress={withApple} height={52} />
      ) : null}
    </AuthStage>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  strong: { fontFamily: theme.fonts.black, color: theme.colors.ink },
  group: {
    gap: theme.spacing(2),
    padding: theme.spacing(3.5),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  groupTitle: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  row: { flexDirection: 'row', gap: theme.spacing(2), alignItems: 'flex-start' },
  rowText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, lineHeight: 19, color: theme.colors.ink },
  check: { flexDirection: 'row', gap: theme.spacing(2.5), alignItems: 'center' },
  checkText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.ink },
  danger: { backgroundColor: theme.colors.dangerDeep },
})

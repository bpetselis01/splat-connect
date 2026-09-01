// packages/mobile/components/profile-screen.tsx
import { useState, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import type { UserAgreement } from '@splat-connect/types'
import { useAuth } from '../lib/auth-context'
import { apiClient } from '../lib/api-client'
import { theme } from '../lib/theme'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { Card } from './ui/Card'
import { TextField } from './ui/TextField'
import { ChildProfileHome } from './profile/child-profile-home'
import { resolveAuthStorage } from '../lib/supabase-storage'
import { TermsCheckbox, ErrorRow } from './auth-screen'

/** "12 Aug 2026" — the terms row's date. */
function acceptedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PROFILE_SEGMENT_KEY = 'profile-tab-segment'
type ProfileSegment = 'account' | 'child-profile'

function useProfileSegment() {
  const [segment, setSegment] = useState<ProfileSegment>('account')
  const storage = resolveAuthStorage()

  useEffect(() => {
    // Storage is a convenience here, not a source of truth: a failed read
    // leaves the default segment rather than an unhandled rejection.
    storage
      .getItem(PROFILE_SEGMENT_KEY)
      .then((saved) => {
        if (saved === 'child-profile') setSegment('child-profile')
      })
      .catch((err) => console.error('[useProfileSegment] could not read segment:', err))
  }, [])

  function select(next: ProfileSegment) {
    setSegment(next)
    storage
      .setItem(PROFILE_SEGMENT_KEY, next)
      .catch((err) => console.error('[useProfileSegment] could not save segment:', err))
  }

  return { segment, select }
}

export function ProfileScreen() {
  const router = useRouter()
  const { session, profile, signOut, hasContributorTerms, acceptContributorTerms } = useAuth()
  const { segment, select: selectSegment } = useProfileSegment()
  const [gateTicked, setGateTicked] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
  // The display name is the one profile field editable here. Committed on end
  // of editing rather than per keystroke — a name is typed once, not streamed.
  const [nameState, setNameState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [terms, setTerms] = useState<UserAgreement | null>(null)

  useEffect(() => {
    let ignore = false
    // The row is a fact display; losing it costs the row, nothing else.
    apiClient
      .get<UserAgreement[]>('/api/agreements/me')
      .then((rows) => {
        if (!ignore) setTerms(rows.find((r) => r.agreement_type === 'contributor_terms') ?? null)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  async function saveName(raw: string) {
    const name = raw.trim()
    if (!name || name === profile?.name) return
    setNameState('saving')
    try {
      await apiClient.patch('/api/contributors/me', { name })
      setNameState('saved')
    } catch (err) {
      console.error('[ProfileScreen] rename failed:', err)
      setNameState('failed')
    }
  }

  // Reached only through the (my) group, whose layout redirects to sign-in
  // without a session — by the time this renders, one is guaranteed to exist.
  const user = session!.user

  return (
    <Screen>
      <View style={styles.segmented}>
        <Pressable
          onPress={() => selectSegment('account')}
          style={[styles.segment, segment === 'account' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, segment === 'account' && styles.segmentTextActive]}>
            Account
          </Text>
        </Pressable>
        <Pressable
          onPress={() => selectSegment('child-profile')}
          style={[styles.segment, segment === 'child-profile' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, segment === 'child-profile' && styles.segmentTextActive]}>
            Child Profile
          </Text>
        </Pressable>
      </View>
      {segment === 'child-profile' ? (
        <ChildProfileHome />
      ) : // Catch-up gate for accounts created before terms were part of signup.
      // Strict `=== false`: hasContributorTerms is null until the /api/agreements/me
      // fetch resolves. Treating null as "unaccepted" flashed this gate for every
      // already-accepted user on every app launch, for as long as that fetch was in
      // flight.
      hasContributorTerms === false ? (
        <Card>
          <Text style={styles.heading}>Before you continue</Text>
          <Text style={styles.checkEmailText}>
            Your account was created before we asked contributors to accept terms.
            These terms have not been written yet, and anything you accept now is not
            binding.
          </Text>
          <TermsCheckbox
            testID="gate-accept-checkbox"
            checked={gateTicked}
            onPress={() => setGateTicked((v) => !v)}
          />
          <ErrorRow message={gateError} />
          <Button
            label="Accept and continue"
            disabled={!gateTicked}
            onPress={async () => {
              const res = await acceptContributorTerms()
              setGateError(res.error)
            }}
          />
          {/* Escape hatch: if acceptance keeps failing (offline, API down), the user
              is stuck on this screen with no other nav — they must still be able to
              sign out or switch accounts. */}
          <Button label="Sign Out" onPress={() => signOut()} variant="ghost" />
        </Card>
      ) : (
        <View>
          <Card style={styles.panel}>
            <Text style={styles.signedInText}>Signed in as {user.email}</Text>
            <Text style={styles.frozenHint}>Your email can&apos;t be changed here.</Text>
            <TextField
              label="Display name"
              accessibilityLabel="Display name"
              defaultValue={profile?.name ?? ''}
              onEndEditing={(e) => void saveName(e.nativeEvent.text)}
            />
            <Text accessibilityLiveRegion="polite" style={styles.nameStatus}>
              {nameState === 'saving'
                ? 'Saving…'
                : nameState === 'saved'
                  ? 'Saved'
                  : nameState === 'failed'
                    ? 'Could not save your name. Please try again.'
                    : ' '}
            </Text>

            {terms ? (
              <Text style={styles.termsRow}>
                {`Contributor terms · accepted ${terms.version} · ${acceptedDate(terms.accepted_at)}`}
              </Text>
            ) : null}

            {profile ? (
              <Button
                label="Open Web Dashboard"
                onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/dashboard`)}
                variant="secondary"
                style={styles.stackedButton}
              />
            ) : null}
            <Button
              label="About SPLAT"
              onPress={() => router.push('/explore/about')}
              variant="secondary"
              style={styles.stackedButton}
            />
            <Button label="Sign Out" onPress={() => signOut()} variant="ghost" />
          </Card>
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  panel: { alignItems: 'stretch' },
  frozenHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing(3),
  },
  nameStatus: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    minHeight: 16,
    marginTop: -theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  termsRow: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginBottom: theme.spacing(3),
  },
  heading: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.title,
    color: theme.colors.text,
    marginBottom: theme.spacing(4),
  },
  stackedButton: { marginBottom: theme.spacing(2), alignSelf: 'stretch' },
  checkEmailText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  signedInText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.body,
    color: theme.colors.text,
    marginBottom: theme.spacing(1),
    textAlign: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radii.md,
    padding: 3,
    marginBottom: theme.spacing(4),
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing(2),
    alignItems: 'center',
    borderRadius: theme.radii.sm,
  },
  segmentActive: {
    backgroundColor: theme.colors.surface,
  },
  segmentText: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  segmentTextActive: {
    color: theme.colors.primary,
  },
})

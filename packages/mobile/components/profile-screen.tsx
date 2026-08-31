// packages/mobile/components/profile-screen.tsx
import { useState, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { useAuth } from '../lib/auth-context'
import { theme } from '../lib/theme'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { Card } from './ui/Card'
import { ChildProfileHome } from './profile/child-profile-home'
import { resolveAuthStorage } from '../lib/supabase-storage'
import { TermsCheckbox, ErrorRow } from './auth-screen'

const PROFILE_SEGMENT_KEY = 'profile-tab-segment'
type ProfileSegment = 'account' | 'child-profile'

function useProfileSegment() {
  const [segment, setSegment] = useState<ProfileSegment>('account')
  const storage = resolveAuthStorage()

  useEffect(() => {
    storage.getItem(PROFILE_SEGMENT_KEY).then((saved) => {
      if (saved === 'child-profile') setSegment('child-profile')
    })
  }, [])

  function select(next: ProfileSegment) {
    setSegment(next)
    storage.setItem(PROFILE_SEGMENT_KEY, next)
  }

  return { segment, select }
}

export function ProfileScreen() {
  const { session, profile, signOut, hasContributorTerms, acceptContributorTerms } = useAuth()
  const { segment, select: selectSegment } = useProfileSegment()
  const [gateTicked, setGateTicked] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)

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
        <Card style={styles.panel}>
          <Text style={styles.signedInText}>Signed in as {user.email}</Text>
          {profile ? (
            <Button
              label="Open Web Dashboard"
              onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/dashboard`)}
              variant="secondary"
              style={styles.stackedButton}
            />
          ) : null}
          <Button label="Sign Out" onPress={() => signOut()} variant="ghost" />
        </Card>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  panel: { alignItems: 'center' },
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

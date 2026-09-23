// packages/mobile/components/profile-screen.tsx
import { useState, useEffect, type ComponentProps } from 'react'
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native'
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
import { TermsCheckbox, ErrorRow } from './auth-screen'
import { ListRow, ListSection } from './list/list-kit'
import { Ionicons } from '@expo/vector-icons'

/** "12 Aug 2026" — the terms row's date. */
function acceptedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "Sam Mitchell" → "SM"; an email when there is no name yet. */
function initialsOf(name: string | null | undefined, email: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length) return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
  return (email ?? '?')[0]!.toUpperCase()
}

function RowIcon({ name }: { name: ComponentProps<typeof Ionicons>['name'] }) {
  return <Ionicons name={name} size={21} color={theme.colors.primaryDark} />
}

export function ProfileScreen() {
  const router = useRouter()
  const { session, profile, signOut, hasContributorTerms, acceptContributorTerms } = useAuth()
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* The board's account page is one scroll: who you are, your
            children, then the profile detail. It used to be two segments. */}
        <View style={styles.idCard}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.avatarText}>{initialsOf(profile?.name, user.email)}</Text>
          </View>
          <View style={styles.idBody}>
            <Text style={styles.idName} numberOfLines={1}>
              {profile?.name?.trim() || 'Your account'}
            </Text>
            <Text style={styles.idEmail} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </View>

        <ListSection>Child profiles</ListSection>
        <ChildProfileHome />

        <ListSection style={styles.sectionGap}>Profile detail</ListSection>
        {/* Catch-up gate for accounts created before terms were part of signup.
            Strict `=== false`: hasContributorTerms is null until the
            /api/agreements/me fetch resolves. Treating null as "unaccepted"
            flashed this gate for every already-accepted user on every app
            launch, for as long as that fetch was in flight. The child
            profiles above stay reachable either way. */}
        {hasContributorTerms === false ? (
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
          <View style={styles.detail}>
            <View style={styles.nameCard}>
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
              <Text style={styles.frozenHint}>Your email can&apos;t be changed here.</Text>
              {terms ? (
                <Text style={styles.termsRow}>
                  {`Contributor terms · accepted ${terms.version} · ${acceptedDate(terms.accepted_at)}`}
                </Text>
              ) : null}
            </View>

            {profile ? (
              <ListRow
                title="Open Web Dashboard"
                thumb={<RowIcon name="desktop-outline" />}
                onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/dashboard`)}
              />
            ) : null}
            <ListRow
              title="About SPLAT"
              thumb={<RowIcon name="information-circle-outline" />}
              onPress={() => router.push('/explore/about')}
            />
            <Button label="Sign Out" onPress={() => signOut()} variant="ghost" />
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: theme.spacing(8) },
  // The board's identity card: initials, name, email in the mono face.
  idCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    marginBottom: 18,
    borderRadius: theme.radii.panel + 4,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: theme.fonts.display, fontSize: 19, color: theme.colors.ink },
  idBody: { flex: 1, minWidth: 0 },
  idName: { fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.ink },
  idEmail: { fontFamily: theme.fonts.numeral, fontSize: 12, color: theme.colors.muted },
  sectionGap: { marginTop: 18 },
  detail: { gap: 9 },
  nameCard: {
    padding: 14,
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(1),
  },
  frozenHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  nameStatus: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    minHeight: 16,
    marginTop: -theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  termsRow: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
  heading: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.title,
    color: theme.colors.text,
    marginBottom: theme.spacing(4),
  },
  checkEmailText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
})

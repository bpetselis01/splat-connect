// packages/mobile/components/profile-screen.tsx
import { logFailure } from '../lib/log'
import { useState, useEffect, useRef, type ComponentProps } from 'react'
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import type { UserAgreement } from '@splat-connect/types'
import { apiMessage, initials } from '@splat-connect/types'
import { useAuth } from '../lib/auth-context'
import { apiClient } from '../lib/api-client'
import { theme } from '../lib/theme'
import { useBottomClearance } from '../lib/bottom-clearance'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { Card } from './ui/Card'
import { TextField } from './ui/TextField'
import { ChildProfileHome } from './profile/child-profile-home'
import { ListRow, ListSection } from './list/list-kit'
import { Ionicons } from '@expo/vector-icons'
import { OrgInvites } from './organisation/org-invites'

/** "12 Aug 2026" — the terms row's date. */
function acceptedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "Sam Mitchell" → "SM"; an email when there is no name yet. */
const initialsOf = (name: string | null | undefined, email: string | undefined) =>
  initials(name) || (email || '?')[0]!.toUpperCase()

function RowIcon({ name }: { name: ComponentProps<typeof Ionicons>['name'] }) {
  return <Ionicons name={name} size={21} color={theme.colors.primaryDark} />
}

const PROVIDER: Record<string, string> = { apple: 'Apple', google: 'Google', email: 'email' }

export function signedInWith(providers: unknown): string {
  const list = Array.isArray(providers) && providers.length ? providers : ['email']
  const names = list.map((p) => PROVIDER[p] ?? p)
  return `Signed in with ${names.join(' and ')}`
}

export function ProfileScreen() {
  const bottom = useBottomClearance()
  const router = useRouter()
  const { session, profile, signOut } = useAuth()
  // The display name is the one profile field editable here. Committed on end
  // of editing rather than per keystroke — a name is typed once, not streamed.
  const [postcodeError, setPostcodeError] = useState<string | null>(null)
  const [occupationError, setOccupationError] = useState<string | null>(null)
  const [nameState, setNameState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [terms, setTerms] = useState<UserAgreement | null>(null)
  // What each field last saved to the server. The auth profile is not
  // refreshed by these saves, so comparing with it alone would call an edit
  // back to the old value "unchanged" and never send it.
  const saved = useRef<{ name?: string; occupation?: string; pickup_postcode?: string }>({})

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
    if (!name || name === (saved.current.name ?? profile?.name)) return
    setNameState('saving')
    try {
      await apiClient.patch('/api/contributors/me', { name })
      saved.current.name = name
      setNameState('saved')
    } catch (err) {
      logFailure('[ProfileScreen] rename failed:', err)
      setNameState('failed')
    }
  }

  // 124. The line under your name on your public profile.
  async function saveOccupation(raw: string) {
    const occupation = raw.trim()
    if (occupation === (saved.current.occupation ?? profile?.occupation ?? '')) return
    setOccupationError(null)
    try {
      await apiClient.patch('/api/contributors/me', { occupation: occupation || null })
      saved.current.occupation = occupation
    } catch (err) {
      logFailure('[ProfileScreen] occupation save failed:', err)
      setOccupationError(apiMessage(err, 'Could not save what you do. Please try again.'))
    }
  }

  // 099. Distance on Find a printer, Makers wanted and the toy library is
  // measured from here. Four digits or nothing; anything else saves and simply
  // measures nothing.
  async function savePostcode(raw: string) {
    const postcode = raw.trim()
    if (postcode === (saved.current.pickup_postcode ?? profile?.pickup_postcode ?? '')) return
    if (postcode && !/^\d{4}$/.test(postcode)) {
      setPostcodeError('A postcode is four digits.')
      return
    }
    setPostcodeError(null)
    try {
      await apiClient.patch('/api/contributors/me', { pickup_postcode: postcode || null })
      saved.current.pickup_postcode = postcode
    } catch (err) {
      logFailure('[ProfileScreen] postcode save failed:', err)
      setPostcodeError(apiMessage(err, 'Could not save your postcode. Please try again.'))
    }
  }

  // Reached only through the (my) group, whose layout redirects to sign-in
  // without a session — by the time this renders, one is guaranteed to exist.
  const user = session!.user

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottom }]}>
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

        <OrgInvites />
        <ListSection>Child profiles</ListSection>
        <ChildProfileHome />

        <ListSection style={styles.sectionGap}>Profile detail</ListSection>
        <View style={styles.detail}>
            <View style={styles.nameCard}>
              <TextField
                label="Display name"
                accessibilityLabel="Display name"
                defaultValue={profile?.name ?? ''}
                onEndEditing={(e) => void saveName(e.nativeEvent.text)}
                onSubmitEditing={(e) => void saveName(e.nativeEvent.text)}
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
              <TextField
                label="What you do"
                accessibilityLabel="What you do"
                placeholder="Occupational therapist"
                maxLength={60}
                defaultValue={profile?.occupation ?? ''}
                onEndEditing={(e) => void saveOccupation(e.nativeEvent.text)}
                onSubmitEditing={(e) => void saveOccupation(e.nativeEvent.text)}
              />
              {occupationError ? <Text accessibilityLiveRegion="polite" style={styles.nameStatus}>{occupationError}</Text> : null}
              <TextField
                label="Postcode"
                accessibilityLabel="Postcode"
                inputMode="numeric"
                maxLength={4}
                defaultValue={profile?.pickup_postcode ?? ''}
                onEndEditing={(e) => void savePostcode(e.nativeEvent.text)}
                onSubmitEditing={(e) => void savePostcode(e.nativeEvent.text)}
              />
              {postcodeError ? <Text accessibilityLiveRegion="polite" style={styles.nameStatus}>{postcodeError}</Text> : null}
              <Text style={styles.frozenHint}>Your email can&apos;t be changed here.</Text>
              {/* HIG: say how this account signs in, so an Apple user knows
                  why there is no password to change. */}
              <Text style={styles.frozenHint}>{signedInWith(session?.user.app_metadata?.providers)}</Text>
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
            {/* Apple 5.1.1(v): deletion in the app, easy to find in account settings. */}
            <Button label="Delete account" variant="danger" onPress={() => router.push('/account/delete')} />
          </View>
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
  avatarText: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.ink },
  idBody: { flex: 1, minWidth: 0 },
  idName: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.ink },
  idEmail: { fontFamily: theme.fonts.numeral, fontSize: theme.type.caption, color: theme.colors.muted },
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

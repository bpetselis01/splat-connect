// packages/mobile/components/profile-screen.tsx
import { useState, useEffect, type ComponentProps } from 'react'
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import type { UserAgreement } from '@splat-connect/types'
import { initials } from '@splat-connect/types'
import { useAuth } from '../lib/auth-context'
import { apiClient } from '../lib/api-client'
import { theme } from '../lib/theme'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { Card } from './ui/Card'
import { TextField } from './ui/TextField'
import { ChildProfileHome } from './profile/child-profile-home'
import { ListRow, ListSection } from './list/list-kit'
import { Ionicons } from '@expo/vector-icons'

/** "12 Aug 2026" — the terms row's date. */
function acceptedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "Sam Mitchell" → "SM"; an email when there is no name yet. */
const initialsOf = (name: string | null | undefined, email: string | undefined) =>
  initials(name) || (email ?? '?')[0]!.toUpperCase()

function RowIcon({ name }: { name: ComponentProps<typeof Ionicons>['name'] }) {
  return <Ionicons name={name} size={21} color={theme.colors.primaryDark} />
}

const PROVIDER: Record<string, string> = { apple: 'Apple', google: 'Google', email: 'email' }

export function signedInWith(providers: unknown): string {
  const names = (Array.isArray(providers) ? providers : ['email']).map((p) => PROVIDER[p] ?? p)
  return `Signed in with ${names.join(' and ')}`
}

export function ProfileScreen() {
  const router = useRouter()
  const { session, profile, signOut } = useAuth()
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

// The CHILD PROFILES group of the Account screen (components/profile-screen.tsx),
// under the identity card — it owns none of the screen chrome (header, account
// identity, sign out), which that screen already provides.
//
// Was a single-child editor; now the list web's profile page keeps — one row
// per child, "+ Add a child", each row into that child's own editor. The row's
// second line is childSummary from @splat-connect/types ("Age 6 · Right hand ·
// Light press"), the same line web's account page shows, or "Not set yet".
import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { childSummary as summaryOf, type ChildProfile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { ErrorRow } from '../auth-screen'
import { ListRow } from '../list/list-kit'

// The board's avatar tints, cycled so neighbouring children never match.
const TINTS = [
  theme.colors.mintSoft,
  theme.colors.honeySoft,
  theme.colors.apricotSoft,
  theme.colors.violetSoft,
  theme.colors.accentLight,
]

function Initial({ name, i }: { name: string; i: number }) {
  return (
    <View style={[styles.avatar, { backgroundColor: TINTS[i % TINTS.length] }]}>
      <Text style={styles.avatarText}>{name.trim()[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  )
}

export function ChildProfileHome() {
  const router = useRouter()
  const [children, setChildren] = useState<ChildProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    apiClient
      .get<ChildProfile[]>('/api/child-profiles')
      .then((list) => {
        if (!ignore) {
          setChildren(list)
          setError(null)
        }
      })
      .catch((err) => {
        console.error('[ChildProfileHome] children fetch failed:', err)
        // Never fold into the empty state: telling a parent their children are
        // gone when the endpoint fell over is a lie about their own family.
        if (!ignore) setError("Couldn't load your child profiles — try again.")
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  // Ages and names change in the per-child editor; the list is stale on the
  // way back without this.
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  async function addChild() {
    setBusy(true)
    setError(null)
    try {
      // An empty row on purpose: every field is optional, and the editor is
      // where the details go — the same order web's Add child flow uses.
      const created = await apiClient.post<ChildProfile>('/api/child-profiles', {})
      router.push({ pathname: '/account/child/[id]', params: { id: created.id } })
    } catch (err) {
      console.error('[ChildProfileHome] create failed:', err)
      setError('Could not add a child profile. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View>
      <Text style={styles.intro}>
        This helps us suggest guides that suit your children. Everything is optional and only
        you can see it — see the{' '}
        <Text
          style={styles.introLink}
          onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/privacy`)}
        >
          privacy policy
        </Text>
        .
      </Text>

      <ErrorRow message={error} />
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}

      {!loading && !error && children.length === 0 ? (
        <Text style={styles.empty}>
          No child profiles yet. A profile can hold an age, how they press a switch and what
          matters in the room — all optional, all private to you.
        </Text>
      ) : null}

      <View style={styles.list}>
        {children.map((child, i) => {
          const name = child.name?.trim() || `Child ${i + 1}`
          return (
            <ListRow
              key={child.id}
              title={name}
              meta={summaryOf(child)}
              metaLines={1}
              thumb={<Initial name={name} i={i} />}
              onPress={() => router.push({ pathname: '/account/child/[id]', params: { id: child.id } })}
              accessibilityHint={`${summaryOf(child)}. Opens the profile.`}
            />
          )
        })}

        <Button label="+ Add a child" variant="ghost" loading={busy} onPress={() => void addChild()} style={styles.add} />
        {!loading && !error && children.length === 0 ? (
          // The wizard: the same questions one at a time, for a first run.
          <Button
            label="Answer a few quick questions"
            variant="secondary"
            onPress={() => router.push('/child')}
            style={styles.wizard}
          />
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
    marginHorizontal: 2,
    marginBottom: theme.spacing(3),
  },
  introLink: { textDecorationLine: 'underline' },
  empty: {
    marginBottom: theme.spacing(3),
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
  },
  list: { gap: 9 },
  avatar: { width: 38, height: 38, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: theme.fonts.black, fontSize: 14, color: theme.colors.ink },
  // The board's dashed "+ Add a child", the full width of the list.
  add: {
    borderStyle: 'dashed',
    borderWidth: theme.border.hairline * 1.5,
    borderColor: theme.colors.muted,
    borderRadius: theme.radii.field + 2,
    minHeight: 52,
  },
  wizard: { borderRadius: theme.radii.pill },
})

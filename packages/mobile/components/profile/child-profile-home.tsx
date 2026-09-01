// Embedded as the "Child Profile" segment of the merged Account screen
// (components/profile-screen.tsx) — it owns none of the screen chrome
// (header, account identity, sign out) since that segment shares a screen
// with the "Account" segment, which already provides all of it.
//
// Was a single-child editor; now the list web's profile page keeps — one row
// per child, "+ Add child", each row into that child's own editor. The row's
// second line is the one-line ability summary the spec asks for, or "Not set
// yet" when the profile is still blank.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { ChildProfile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ErrorRow } from '../auth-screen'
import { AnimatedPressable } from '../ui/AnimatedPressable'

/** "Age 5", or 'Not set yet' when the profile is still blank. */
function summaryOf(child: ChildProfile): string {
  return child.age !== null ? `Age ${child.age}` : 'Not set yet'
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
      <View style={styles.headerRow}>
        <Text style={styles.intro}>
          This helps us suggest guides that suit your children. Everything is optional and only
          you can see it.
        </Text>
        <Button label="+ Add child" variant="accent" loading={busy} onPress={() => void addChild()} style={styles.addChild} />
      </View>

      <ErrorRow message={error} />
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}

      {!loading && !error && children.length === 0 ? (
        <Text style={styles.empty}>
          No child profiles yet. A profile can hold age, hand use and grip details — all
          optional, all private to you.
        </Text>
      ) : null}

      {children.map((child, i) => (
        <AnimatedPressable
          key={child.id}
          onPress={() => router.push({ pathname: '/account/child/[id]', params: { id: child.id } })}
          accessibilityRole="button"
          accessibilityLabel={child.name?.trim() || `Child ${i + 1}`}
          accessibilityHint={`${summaryOf(child)}. Opens the profile.`}
          pressScale={0.985}
          style={styles.rowPress}
        >
          <Card style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="happy-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{child.name?.trim() || `Child ${i + 1}`}</Text>
              <Text style={styles.rowHint} numberOfLines={1}>
                {summaryOf(child)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
          </Card>
        </AnimatedPressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  headerRow: { marginBottom: theme.spacing(3) },
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
    marginBottom: theme.spacing(3),
  },
  addChild: { alignSelf: 'flex-start', paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(4) },
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
    marginTop: theme.spacing(2),
  },
  rowPress: { marginBottom: theme.spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(4) },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.text },
  rowHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
})

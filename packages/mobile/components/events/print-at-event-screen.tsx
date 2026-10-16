// packages/mobile/components/events/print-at-event-screen.tsx
/**
 * Ask an event's host to print a guide's parts before the day.
 *
 * Pick a guide from the ones you have saved, tick its parts, say how many sets,
 * and send. POST /api/toy-transactions/print-at-event makes the same kind of
 * row as a job sent to a printer, so it shows up under My events. The server's
 * sentences (no parts ticked, no room left, a request already open) are shown
 * word for word.
 */
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { apiMessage, type StlFile, type Tutorial } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useAuth } from '../../lib/auth-context'
import { type EventDetail, eventPath } from '../../lib/events'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { ErrorRow } from '../ui/ErrorRow'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListSection } from '../list/list-kit'

type Saved = Pick<Tutorial, 'id' | 'title'> & { author_name?: string | null }
type Guide = Tutorial & { stl_files: StlFile[] }

export function PrintAtEventScreen({ id }: { id: string }) {
  const router = useRouter()
  const { session } = useAuth()
  const bottom = useBottomClearance()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [saved, setSaved] = useState<Saved[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [guideId, setGuideId] = useState<string | null>(null)
  const [guide, setGuide] = useState<Guide | null>(null)
  const [guideFailed, setGuideFailed] = useState(false)
  const [parts, setParts] = useState<string[]>([])
  const [sets, setSets] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoadFailed(false)
    Promise.all([apiClient.get<EventDetail>(eventPath(id, session?.user.id)), apiClient.get<Saved[]>('/api/saves/tutorials')])
      .then(([e, s]) => {
        setEvent(e)
        setSaved(s)
      })
      .catch(() => setLoadFailed(true))
  }, [id, session?.user.id])
  useFocusEffect(load)

  useEffect(() => {
    if (!guideId) return
    setGuide(null)
    setGuideFailed(false)
    apiClient
      .get<Guide>(`/api/public/tutorials/${guideId}`)
      .then((g) => {
        setGuide(g)
        setParts(g.stl_files.map((f) => f.id))
      })
      .catch(() => setGuideFailed(true))
  }, [guideId])

  if (loadFailed) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Could not load this event." hint="Check your connection and try again.">
          <Button label="Try again" variant="secondary" onPress={load} />
        </EmptyState>
      </Screen>
    )
  }
  if (!event || !saved) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (!event.prints_parts) {
    return (
      <Screen>
        <EmptyState icon="print-outline" title="This host is not printing parts before the day." />
      </Screen>
    )
  }
  if (saved.length === 0) {
    return (
      <Screen>
        <EmptyState icon="bookmark-outline" title="Save a guide first." hint="Print parts picks from the guides you have saved. Save one from its page, then come back.">
          <Button label="Browse guides" variant="secondary" onPress={() => router.push('/guides')} />
        </EmptyState>
      </Screen>
    )
  }

  const maxSets = Math.min(event.part_sets_max ?? 20, 20)

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post('/api/toy-transactions/print-at-event', {
        event_id: id,
        tutorial_id: guideId,
        stl_file_ids: parts,
        part_sets: sets,
        note: note.trim() || undefined,
      })
      router.replace('/events')
    } catch (err) {
      setError(apiMessage(err, 'That did not send. Check your connection and try again.'))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.meta}>
          {event.org?.name ?? 'The host'} prints your parts before {event.title}. You cover the filament and settle it with them, not through SPLAT.
        </Text>

        <View>
          <ListSection>Guide</ListSection>
          <View accessibilityRole="radiogroup" style={styles.list}>
            {saved.map((g) => {
              const on = g.id === guideId
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={g.title}
                  onPress={() => setGuideId(g.id)}
                  style={[styles.part, on && styles.partOn]}
                >
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? theme.colors.primaryDark : theme.colors.muted} />
                  <View style={styles.flex}>
                    <Text style={styles.partName}>{g.title}</Text>
                    {g.author_name ? <Text style={styles.meta}>by {g.author_name}</Text> : null}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        {guideId && guideFailed ? (
          <Text style={styles.failed}>Could not load that guide's parts.</Text>
        ) : guideId && !guide ? (
          <SkeletonRow />
        ) : guide ? (
          <>
            <View>
              <ListSection>Parts</ListSection>
              <View style={styles.list}>
                {guide.stl_files.map((f) => {
                  const on = parts.includes(f.id)
                  return (
                    <Pressable
                      key={f.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`Include ${f.filename}`}
                      onPress={() => setParts((cur) => (on ? cur.filter((x) => x !== f.id) : [...cur, f.id]))}
                      style={[styles.part, on && styles.partOn]}
                    >
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? theme.colors.primaryDark : theme.colors.muted} />
                      <Text style={[styles.partName, styles.flex]}>{f.filename}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <View>
              <ListSection>Sets</ListSection>
              <View style={styles.stepper}>
                <Pressable accessibilityRole="button" accessibilityLabel="Fewer sets" disabled={sets <= 1} onPress={() => setSets((n) => n - 1)} hitSlop={8}>
                  <Ionicons name="remove-circle-outline" size={32} color={sets <= 1 ? theme.colors.muted : theme.colors.primaryDark} />
                </Pressable>
                <Text accessibilityLiveRegion="polite" style={styles.partName}>{sets} {sets === 1 ? 'set' : 'sets'}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="More sets" disabled={sets >= maxSets} onPress={() => setSets((n) => n + 1)} hitSlop={8}>
                  <Ionicons name="add-circle-outline" size={32} color={sets >= maxSets ? theme.colors.muted : theme.colors.primaryDark} />
                </Pressable>
                <Text style={styles.meta}>The host has room for up to {maxSets}.</Text>
              </View>
            </View>

            <TextField
              label="Note to the host (optional)"
              accessibilityLabel="Note to the host"
              value={note}
              onChangeText={setNote}
              maxLength={1000}
              multiline
              style={styles.note}
            />
          </>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottom }]}>
        <ErrorRow message={error} />
        <Button label="Send request" disabled={!guide} loading={busy} onPress={() => void send()} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { paddingBottom: theme.spacing(6), gap: theme.spacing(5) },
  list: { gap: theme.spacing(2) },
  part: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(4), minHeight: 60,
    borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  partOn: { borderColor: theme.colors.primaryDark, backgroundColor: theme.colors.accentFaint },
  partName: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, lineHeight: 19, color: theme.colors.muted },
  failed: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.danger },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), flexWrap: 'wrap' },
  note: { minHeight: 80, textAlignVertical: 'top' },
  footer: { borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },
})

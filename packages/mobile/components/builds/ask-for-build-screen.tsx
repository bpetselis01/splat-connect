// packages/mobile/components/builds/ask-for-build-screen.tsx
/**
 * Ask for a build — post a request to the Makers wanted board. Mobile's half of
 * web's components/ask-openly-form.tsx, laid out as the board's #mw_new sheet,
 * posting to the same POST /api/toy-transactions/build with no maker named.
 *
 * Where it departs from the board, the API decided:
 * - "Your suburb" is a field the board does not draw. An open request needs a
 *   suburb and a travel range on its card or no maker can act on it, and the
 *   API refuses one without them. Seeded from the profile's pickup suburb.
 * - The note is required, not "(optional)": build_brief is the one field the
 *   API will not take empty.
 * - No parts price. Guides do not store one, so "roughly $30" would be made up.
 */
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tutorial } from '@splat-connect/types'
import { apiMessage, formatBuildTime } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { ErrorRow } from '../auth-screen'

// The board's four ranges; the Makers wanted filter reads the same scale.
const RANGES = [5, 10, 15, 25]
// Web's list (ask-openly-form.tsx), so a request reads the same on both boards.
const URGENCIES = ['No rush', 'Before school holidays', 'Within a month', 'As soon as someone can']

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const

export function AskForBuildScreen() {
  const router = useRouter()
  const { guide } = useLocalSearchParams<{ guide?: string }>()
  const { caps } = useCapabilities()
  const [tutorials, setTutorials] = useState<Tutorial[]>([])
  const [query, setQuery] = useState('')
  const [tutorialId, setTutorialId] = useState(guide ?? '')
  const [childLabel, setChildLabel] = useState('')
  const [suburb, setSuburb] = useState('')
  const [brief, setBrief] = useState('')
  const [travelKm, setTravelKm] = useState(10)
  const [urgency, setUrgency] = useState(URGENCIES[0])
  const [covers, setCovers] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<Tutorial[]>('/api/public/tutorials')
      .then(setTutorials)
      .catch((err) => {
        console.error('[AskForBuildScreen] tutorials fetch failed:', err)
        setError("Couldn't load the guides. Close this and try again.")
      })
  }, [])

  // Seeded once the profile lands, and never over something already typed.
  const profileSuburb = caps?.profile.pickup_suburb ?? ''
  useEffect(() => {
    if (profileSuburb) setSuburb((cur) => cur || profileSuburb)
  }, [profileSuburb])

  const picked = tutorials.find((t) => t.id === tutorialId)
  const q = query.trim().toLowerCase()
  const results = q ? tutorials.filter((t) => t.title.toLowerCase().includes(q)) : tutorials

  async function submit() {
    // Said in the order the form asks, one at a time — the board's toasts.
    if (!tutorialId) return setError('Pick the guide you want built.')
    if (!suburb.trim()) return setError('Say which suburb you are in — never your address.')
    if (!brief.trim()) return setError('Add a note to the maker — why this toy, and the switch you have.')
    if (!covers) return setError('Tick that you will cover the parts.')
    setBusy(true)
    setError(null)
    try {
      await apiClient.post('/api/toy-transactions/build', {
        tutorial_id: tutorialId,
        build_brief: brief.trim(),
        child_label: childLabel.trim(),
        requester_suburb: suburb.trim(),
        travel_km: travelKm,
        urgency,
        // No maker_id and no maker_org_id: that is what makes it open.
      })
      // Back to the board on the Yours tab, as the artboard does. dismissTo
      // replaces this sheet when it was opened from somewhere else.
      router.dismissTo({ pathname: '/explore/makers-wanted', params: { tab: 'mine' } })
    } catch (err) {
      setError(apiMessage(err, 'That did not post. Try once more.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            No fee to ask, and you cover the parts. Makers within your travel range see it; the first
            to claim opens a thread in My exchanges.
          </Text>

          <View>
            <Text style={styles.label}>Which guide?</Text>
            {picked ? (
              <GuideRow t={picked} on onPress={() => setTutorialId('')} action="Change" />
            ) : (
              <>
                <TextField
                  icon="search"
                  accessibilityLabel="Search guides"
                  placeholder="Search by toy, switch or guide name"
                  value={query}
                  onChangeText={setQuery}
                />
                <View accessibilityRole="radiogroup" style={styles.guides}>
                  {results.map((t) => (
                    <GuideRow key={t.id} t={t} on={false} onPress={() => setTutorialId(t.id)} />
                  ))}
                  {tutorials.length > 0 && results.length === 0 ? (
                    <Text style={styles.hint}>No published guide matches that. If it does not exist yet, submit an idea instead.</Text>
                  ) : null}
                </View>
              </>
            )}
          </View>

          <TextField
            label="Who is it for?"
            placeholder="e.g. Leo, 3 — 100 mm button switch"
            maxLength={60}
            value={childLabel}
            onChangeText={setChildLabel}
            hint="The maker sees this and your suburb, never your address."
          />
          <TextField
            label="Your suburb"
            placeholder="Newtown"
            maxLength={80}
            value={suburb}
            onChangeText={setSuburb}
            hint="The suburb only — it goes on the card."
          />
          <TextField
            label="A note to the maker"
            placeholder="Why this toy, the switch you have, what makes handover easy"
            maxLength={2000}
            multiline
            value={brief}
            onChangeText={setBrief}
            style={styles.note}
          />

          <View>
            <Text style={styles.label}>How far can you travel?</Text>
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {RANGES.map((km) => (
                <Chip key={km} role="radio" label={`${km} km`} active={travelKm === km} onPress={() => setTravelKm(km)} />
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.label}>How soon?</Text>
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {URGENCIES.map((u) => (
                <Chip key={u} role="radio" label={u} active={urgency === u} onPress={() => setUrgency(u)} />
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => setCovers((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: covers }}
            style={[styles.covers, covers && styles.coversOn]}
          >
            <Ionicons
              name={covers ? 'checkbox' : 'square-outline'}
              size={24}
              color={covers ? theme.colors.successDeep : theme.colors.muted}
            />
            <View style={styles.coversBody}>
              <Text style={styles.coversTitle}>You cover the parts</Text>
              <Text style={styles.coversText}>
                The maker never pays for your build — settle the receipt in the thread. SPLAT never
                handles money. Tick this before you post.
              </Text>
            </View>
          </Pressable>

          <ErrorRow message={error} />

          <Button label={busy ? 'Posting…' : 'Post to Makers wanted'} disabled={busy} onPress={submit} />
          <Text style={styles.footnote}>You can withdraw it any time before a maker claims it.</Text>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  )
}

function GuideRow({ t, on, onPress, action }: { t: Tutorial; on: boolean; onPress: () => void; action?: string }) {
  const meta = [DIFF_LABEL[t.difficulty], t.build_minutes ? formatBuildTime(t.build_minutes) : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t.title}
      accessibilityHint={action ? 'Pick a different guide' : undefined}
      style={[styles.guide, on && styles.guideOn]}
    >
      <View style={[styles.tile, { backgroundColor: theme.colors.difficulty[t.difficulty].bg }]}>
        <Ionicons name="book-outline" size={22} color={theme.colors.ink} />
      </View>
      <View style={styles.guideBody}>
        <Text style={styles.guideTitle}>{t.title}</Text>
        <Text style={styles.guideMeta}>{meta}</Text>
      </View>
      {action ? <Text style={styles.guideAction}>{action}</Text> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: theme.spacing(8), gap: theme.spacing(4) },
  intro: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  label: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.text, marginBottom: theme.spacing(2) },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 18 },
  guides: { gap: theme.spacing(2) },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(3),
    borderRadius: theme.radii.panel,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  guideOn: { borderColor: theme.colors.primaryDark, backgroundColor: theme.colors.accentLight },
  tile: { width: 48, height: 48, borderRadius: theme.radii.field, alignItems: 'center', justifyContent: 'center' },
  guideBody: { flex: 1, minWidth: 0 },
  guideTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.text },
  guideMeta: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  guideAction: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  note: { minHeight: 88, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1.5) },
  covers: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(3),
    padding: theme.spacing(3),
    borderRadius: theme.radii.panel,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSunken,
  },
  coversOn: { borderColor: theme.colors.success, backgroundColor: theme.colors.tone.mint.bg },
  coversBody: { flex: 1, minWidth: 0 },
  coversTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.text },
  coversText: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 18, marginTop: 2 },
  footnote: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, textAlign: 'center' },
})

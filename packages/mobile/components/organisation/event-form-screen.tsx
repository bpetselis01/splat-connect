// packages/mobile/components/organisation/event-form-screen.tsx
/**
 * Publish an event — web's components/event-form.tsx on the phone.
 *
 * Four things are enough to publish (name, when, where, who for); everything
 * else is optional and the form says so. Save as draft never validates. The
 * registration questions are edited here and sent whole after the event saves,
 * the same PUT web makes.
 *
 * Date and times come from the system picker (ui/DateTimeField), which fills
 * the same strings a typed field would — 2026-10-18, 10:00 — so localDate below
 * checks one shape on every platform, web's typed fallback included.
 *
 * Both buttons return to Events and stories — mobile has no public event page.
 */
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  ANSWER_TYPES,
  AU_STATES,
  EVENT_KINDS,
  EVENT_KIND_LABEL,
  EVENT_TOOLS,
  dollarsToCents,
  type AnswerType,
  type EventKind,
  type OrgEvent,
} from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { DateTimeField } from '../ui/DateTimeField'
import { SkeletonRow } from '../ui/Skeleton'

type DraftQuestion = { prompt: string; answer_type: AnswerType; required: boolean; options: string[] }

// Web's one-tap starters: the useful questions free, rather than warnings against the rest.
const COMMON_ASKS: Array<{ label: string; q: DraftQuestion }> = [
  { label: 'Head count', q: { prompt: 'How many people are coming, including you?', answer_type: 'number', required: true, options: [] } },
  { label: 'Toy they bring', q: { prompt: 'What toy are you bringing?', answer_type: 'short', required: true, options: [] } },
  { label: 'Access needs', q: { prompt: 'Anything we should know about access, sensory or support needs?', answer_type: 'paragraph', required: false, options: [] } },
  { label: 'Child’s age', q: { prompt: 'How old is your child?', answer_type: 'number', required: false, options: [] } },
  { label: 'Soldering', q: { prompt: 'Have you soldered before?', answer_type: 'boolean', required: false, options: [] } },
  { label: 'Parking', q: { prompt: 'Will you need a parking space?', answer_type: 'boolean', required: false, options: [] } },
]

/** A local Date from typed parts, or null. Built from numbers, not an
 *  offset-less ISO string, so the host's "10:00" is their own clock's 10am. */
export function localDate(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!d || !t) return null
  const at = new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2])
  // Rejects 2026-02-31 and 25:00, which Date would quietly roll over.
  return at.getMonth() === +d[2] - 1 && at.getHours() === +t[1] && +t[2] < 60 ? at : null
}

/** A round hour today, where an empty time picker opens. */
const hourToday = (hour: number) => new Date(new Date().setHours(hour, 0, 0, 0))

export function EventFormScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const org = caps?.ledOrgs[0]

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<EventKind>('build_day')
  const [date, setDate] = useState('')
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  const [format, setFormat] = useState<'in_person' | 'online'>('in_person')
  const [location, setLocation] = useState('')
  const [suburb, setSuburb] = useState('')
  const [state, setState] = useState<string>('NSW')
  const [onlineUrl, setOnlineUrl] = useState('')
  const [audience, setAudience] = useState('')
  const [description, setDescription] = useState('')
  const [whatToBring, setWhatToBring] = useState('')
  const [capacity, setCapacity] = useState('')
  const [printsParts, setPrintsParts] = useState(false)
  const [partSetsMax, setPartSetsMax] = useState('6')
  const [tools, setTools] = useState<string[]>([])
  const [accessibility, setAccessibility] = useState('')
  const [costDollars, setCostDollars] = useState('')
  const [costNote, setCostNote] = useState('')
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null)

  if (!org) {
    return (
      <Screen>
        <SkeletonRow />
      </Screen>
    )
  }

  const costCents = costDollars.trim() === '' ? 0 : dollarsToCents(costDollars)
  const startAt = localDate(date, starts)
  const endAt = ends.trim() ? localDate(date, ends) : null

  const missing: string[] = []
  if (!title.trim()) missing.push('a name')
  if (!startAt) missing.push('a date and start time')
  if (ends.trim() && !endAt) missing.push('an end time like 15:30')
  if (format === 'in_person' && !location.trim()) missing.push('a venue')
  if (format === 'in_person' && !suburb.trim()) missing.push('a suburb')
  if (format === 'online' && !onlineUrl.trim()) missing.push('a joining link')
  if (!audience.trim()) missing.push('who it is for')
  if (costCents === null) missing.push('a cost written as dollars, like 12 or 12.50')
  // Checked before anything is sent: the event is written first and the
  // questions second, so a refusal at the second step would leave the event
  // saved and a retry would publish it twice.
  const blankQuestion = questions.some((q) => !q.prompt.trim())
  if (blankQuestion) missing.push('something to ask in every question')

  const patchQuestion = (i: number, patch: Partial<DraftQuestion>) =>
    setQuestions((prev) => prev.map((q, j) => (i === j ? { ...q, ...patch } : q)))
  const move = (i: number, by: -1 | 1) =>
    setQuestions((prev) => {
      const j = i + by
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  async function save(status: 'draft' | 'published') {
    if (blankQuestion) {
      setError('Every question needs something to ask. Fill it in or remove it.')
      return
    }
    setError(null)
    setSaving(status)
    try {
      const saved = await apiClient.post<OrgEvent>(`/api/organizations/${org!.id}/events`, {
        title: title.trim(),
        kind,
        starts_at: startAt?.toISOString(),
        ends_at: endAt?.toISOString() ?? null,
        format,
        location: location.trim(),
        suburb: suburb.trim(),
        state,
        online_url: onlineUrl.trim(),
        audience: audience.trim(),
        description: description.trim(),
        what_to_bring: whatToBring.trim(),
        tools,
        capacity: capacity.trim() === '' ? null : Number(capacity),
        prints_parts: printsParts,
        part_sets_max: printsParts ? Number(partSetsMax) : null,
        accessibility_note: accessibility.trim(),
        cost_cents: costCents ?? 0,
        cost_note: costNote.trim(),
        status,
      })
      await apiClient.put(`/api/organizations/${org!.id}/events/${saved.id}/questions`, { questions })
      router.back()
    } catch (e) {
      const detail = e instanceof Error ? /: (.+)$/.exec(e.message)?.[1] : null
      setError(detail ?? 'That did not save. Try once more.')
      setSaving(null)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.lede}>
          Families decide from four things: what it is, when, where, and whether it is for them. Fill those and it is
          enough to publish.
        </Text>

        <TextField label="Event name" value={title} onChangeText={setTitle} maxLength={160} placeholder="Switch-adaptation build day" />

        <Text style={styles.label}>What kind of event?</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => (
            <Chip key={k} role="radio" label={EVENT_KIND_LABEL[k]} active={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <Text style={styles.help}>{EVENT_KINDS[kind]}</Text>

        <DateTimeField label="Date" mode="date" value={date} onChange={setDate} placeholder="2026-10-18" minimumDate={new Date()} />
        {/* One per row: the iOS time wheel is wider than half the screen. */}
        <DateTimeField label="Starts" mode="time" value={starts} onChange={setStarts} placeholder="10:00" openOn={hourToday(10)} />
        <DateTimeField label="Ends" mode="time" value={ends} onChange={setEnds} placeholder="14:00" openOn={hourToday(14)} />

        <Text style={styles.label}>Where</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          <Chip role="radio" label="In person" active={format === 'in_person'} onPress={() => setFormat('in_person')} />
          <Chip role="radio" label="Online" active={format === 'online'} onPress={() => setFormat('online')} />
        </View>
        {format === 'in_person' ? (
          <>
            <TextField label="Venue and street" value={location} onChangeText={setLocation} placeholder="Northside Therapy, 14 Corella St" />
            <TextField label="Suburb" value={suburb} onChangeText={setSuburb} placeholder="Crows Nest" />
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="State">
              {AU_STATES.map((s) => (
                <Chip key={s} role="radio" label={s} active={state === s} onPress={() => setState(s)} />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.note}>The meeting link is not shown publicly. It is hidden until somebody says they are coming.</Text>
            <TextField label="Meeting link" value={onlineUrl} onChangeText={setOnlineUrl} placeholder="https://meet…" autoCapitalize="none" keyboardType="url" />
          </>
        )}

        <TextField
          label="Who is it for?"
          value={audience}
          onChangeText={setAudience}
          maxLength={200}
          placeholder="Parents and carers with a toy to adapt. No experience needed."
        />
        <TextField label="What to bring (optional)" value={whatToBring} onChangeText={setWhatToBring} placeholder="The toy and its batteries. We supply the rest." />
        <TextField label="Seats (blank = no limit)" value={capacity} onChangeText={setCapacity} placeholder="16" keyboardType="number-pad" />

        <View style={styles.well}>
          <Text style={styles.label}>On the day</Text>
          <Text style={styles.help}>Families see this when they ask for help with a guide.</Text>
          <Text style={styles.label}>Can you print parts before the day?</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            <Chip role="radio" label="Yes, on request" active={printsParts} onPress={() => setPrintsParts(true)} />
            <Chip role="radio" label="No" active={!printsParts} onPress={() => setPrintsParts(false)} />
          </View>
          {printsParts ? (
            <TextField label="Up to how many part sets" value={partSetsMax} onChangeText={setPartSetsMax} keyboardType="number-pad" maxLength={3} />
          ) : null}
          <Text style={styles.help}>
            {printsParts
              ? 'Families who ask for help with a printable guide can choose “the host prints them”. Each request lands on this event for you to accept or decline.'
              : 'Families will be asked to pick a printer themselves before the day.'}
          </Text>
          <Text style={styles.label}>Tools on the bench</Text>
          <View style={styles.chips}>
            {EVENT_TOOLS.map((tool) => (
              <Chip
                key={tool}
                label={tool}
                active={tools.includes(tool)}
                onPress={() => setTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]))}
              />
            ))}
          </View>
        </View>

        <TextField
          label="Access notes (optional)"
          value={accessibility}
          onChangeText={setAccessibility}
          maxLength={500}
          placeholder="Step-free entry, accessible toilet, quiet room available."
        />

        <View style={styles.well}>
          <Text style={styles.label}>What it costs a family to come</Text>
          <Text style={styles.help}>Leave it empty and the event shows as free to attend.</Text>
          <TextField label="Amount, in dollars" value={costDollars} onChangeText={setCostDollars} placeholder="0.00" keyboardType="decimal-pad" />
          <TextField
            label="Breakdown, in your words"
            value={costNote}
            onChangeText={setCostNote}
            maxLength={500}
            placeholder="e.g. kits are bought in bulk and passed on at cost."
          />
          <Text style={styles.help}>SPLAT never takes the payment. Families read the figure before they confirm and settle it with you directly.</Text>
        </View>

        <View style={styles.well}>
          <Text style={styles.label}>
            Registration form · {questions.length} question{questions.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.help}>
            What people answer when they tap I'm going. Name and email are always asked. Add only what changes how you run
            the day — every extra question loses people.
          </Text>
          {questions.map((q, i) => (
            <View key={i} style={styles.question}>
              <TextField
                label={`Question ${i + 1}`}
                value={q.prompt}
                onChangeText={(prompt) => patchQuestion(i, { prompt })}
                placeholder="Ask one thing, plainly"
              />
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Answer type">
                {(Object.keys(ANSWER_TYPES) as AnswerType[]).map((t) => (
                  <Chip key={t} role="radio" label={ANSWER_TYPES[t]} active={q.answer_type === t} onPress={() => patchQuestion(i, { answer_type: t })} />
                ))}
              </View>
              {q.answer_type === 'choice' ? (
                <TextField
                  label="Options, separated by commas"
                  value={q.options.join(', ')}
                  onChangeText={(v) => patchQuestion(i, { options: v.split(',').map((o) => o.trim()).filter(Boolean) })}
                />
              ) : null}
              <View style={styles.qActions}>
                <Chip label={q.required ? 'Required' : 'Optional'} active={q.required} onPress={() => patchQuestion(i, { required: !q.required })} />
                <View style={styles.qIcons}>
                  {([
                    ['arrow-up', 'up', -1],
                    ['arrow-down', 'down', 1],
                  ] as const).map(([icon, word, by]) => (
                    <Pressable
                      key={icon}
                      onPress={() => move(i, by)}
                      disabled={by === -1 ? i === 0 : i === questions.length - 1}
                      accessibilityRole="button"
                      accessibilityLabel={`Move "${q.prompt || 'question'}" ${word}`}
                      style={styles.iconBtn}
                    >
                      <Ionicons name={icon} size={18} color={theme.colors.muted} />
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove "${q.prompt || 'question'}"`}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
          <Text style={styles.kicker}>Add</Text>
          <View style={styles.chips}>
            {(Object.keys(ANSWER_TYPES) as AnswerType[]).map((t) => (
              <Chip
                key={t}
                label={`+ ${ANSWER_TYPES[t]}`}
                active={false}
                onPress={() => setQuestions((prev) => [...prev, { prompt: '', answer_type: t, required: false, options: t === 'choice' ? ['Yes'] : [] }])}
              />
            ))}
          </View>
          <Text style={styles.kicker}>Common asks</Text>
          <View style={styles.chips}>
            {COMMON_ASKS.map((ask) => (
              <Chip key={ask.label} label={`+ ${ask.label}`} active={false} onPress={() => setQuestions((prev) => [...prev, { ...ask.q }])} />
            ))}
          </View>
        </View>

        <TextField
          label="About the event"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="What happens, who will be there, and what people leave with."
          style={styles.body}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Publish to Events" onPress={() => void save('published')} disabled={saving !== null || missing.length > 0} loading={saving === 'published'} />
        <Button label="Save as draft" variant="secondary" onPress={() => void save('draft')} disabled={saving !== null} loading={saving === 'draft'} />
        <Text style={styles.help}>
          Published as {org.name}.
          {missing.length > 0 ? ` Still needs ${missing.join(', ')} before it can be published. Save it as a draft meanwhile.` : ''}
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(3), paddingBottom: theme.spacing(10) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  kicker: { fontFamily: theme.fonts.black, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.muted },
  help: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19 },
  note: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
    padding: theme.spacing(3),
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.tone.sunken.bg,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  well: { gap: theme.spacing(2), padding: theme.spacing(3), borderRadius: theme.radii.panel, backgroundColor: theme.colors.tone.sunken.bg },
  question: { gap: theme.spacing(2), padding: theme.spacing(3), borderRadius: theme.radii.panel, backgroundColor: theme.colors.surface },
  qActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qIcons: { flexDirection: 'row', gap: theme.spacing(1) },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.field },
  body: { minHeight: 120, textAlignVertical: 'top' },
  error: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.danger },
})

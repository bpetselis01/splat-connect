// packages/mobile/components/recycling/recycling-screen.tsx
/**
 * Recycling — the contributor's side. The board's two modes on one route: the
 * list (what you have diverted, your drop-offs, who takes plastic) and the
 * booking form for one organisation, swapped in place rather than pushed, as
 * the board has it.
 *
 * Web's rules, not new ones (components/dropoff-form.tsx): two kilos minimum,
 * one polymer from that organisation's own list, all seven declaration lines,
 * and the declaration's version sent so the API can refuse a stale wording.
 * Credit is shown as the organisation recorded it and never computed here —
 * the "worth roughly" panel is labelled an estimate for that reason.
 *
 * Where the board draws fields no column holds (machines, per-drop maximum,
 * turnaround, hours, door, spool-or-credit), the organisation's free-text
 * recycling_note stands in, exactly as web's intake editor decided.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { RecyclingDropoff } from '@splat-connect/types'
import {
  DECLARATION_VERSION,
  MIN_DROPOFF_GRAMS,
  RECYCLING_DECLARATION,
  estimatedCreditGrams,
} from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import {
  DROPOFF_PILL,
  apiMessage,
  badges,
  bookingProblem,
  diverted,
  initials,
  kg,
  kgToGrams,
  takers,
  type TakerOrg,
} from '../../lib/recycling'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'
import { ErrorRow } from '../auth-screen'

type Ion = React.ComponentProps<typeof Ionicons>['name']
// The board's glyph for each declaration line, in RECYCLING_DECLARATION's order.
const DECL_ICONS: Ion[] = [
  'water-outline',
  'pricetag-outline',
  'funnel-outline',
  'ban-outline',
  'resize-outline',
  'help-circle-outline',
  'camera-outline',
]
const BADGE_ICONS: Ion[] = ['leaf-outline', 'leaf', 'flower-outline', 'earth-outline']
const TINTS = [
  theme.colors.mintSoft,
  theme.colors.honeySoft,
  theme.colors.violetSoft,
  theme.colors.accentLight,
  theme.colors.apricotSoft,
]

const place = (o: TakerOrg) => [o.suburb, o.state].filter(Boolean).join(' ')
const date = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })

export function RecyclingScreen() {
  const { caps } = useCapabilities()
  const me = caps?.profile.id
  const [orgs, setOrgs] = useState<TakerOrg[]>([])
  const [drops, setDrops] = useState<RecyclingDropoff[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [bookingAt, setBookingAt] = useState<TakerOrg | null>(null)
  const [booked, setBooked] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!me) return
    try {
      const all = await apiClient.get<TakerOrg[]>('/api/public/organizations')
      // ponytail: one read per organisation — there is no cross-organisation
      // "my drop-offs" endpoint (web draws no such panel for the same reason).
      // Every org, not only current takers, so a drop at one that has since
      // stopped taking plastic still shows. Add GET /recycling/mine when the
      // directory outgrows a handful of requests.
      const per = await Promise.all(
        all.map((o) =>
          apiClient.get<RecyclingDropoff[]>(`/api/organizations/${o.id}/recycling`).catch(() => [])
        )
      )
      setOrgs(all)
      // A leader's read of their own org returns everybody's rows (RLS admits
      // both), so "yours" is filtered here rather than assumed.
      setDrops(
        per
          .flat()
          .filter((d) => d.contributor_id === me)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      )
      setLoadError(false)
    } catch (err) {
      console.error('[RecyclingScreen] load failed:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [me])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  if (bookingAt) {
    return (
      <BookDropoff
        org={bookingAt}
        onBack={() => setBookingAt(null)}
        onBooked={(line) => {
          setBookingAt(null)
          setBooked(line)
          load()
        }}
      />
    )
  }

  const open = takers(orgs)
  const nameOf = (id: string) => orgs.find((o) => o.id === id)?.name ?? 'An organisation'
  const total = diverted(drops)

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Failed prints and offcuts are the raw material for the next switch mount. Bring clean,
          sorted plastic to an organisation that runs a shredder and extruder, and they turn it
          into filament. Minimum {MIN_DROPOFF_GRAMS / 1000} kg a drop.
        </Text>

        {booked ? (
          <View style={styles.bookedNote} accessibilityRole="alert">
            <Ionicons name="calendar-outline" size={18} color={theme.colors.ink} />
            <Text style={styles.bookedText}>{booked}</Text>
          </View>
        ) : null}

        {loading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <ErrorRow message="Couldn't load recycling — try again." />
            <Button label="Try again" variant="secondary" onPress={load} />
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>Diverted from landfill</Text>
              <Text style={styles.heroNumber}>
                {(total.grams / 1000).toFixed(1)} <Text style={styles.heroUnit}>kg</Text>
              </Text>
              {/* "Issued", not the board's "unspent": nothing records spending
                  credit yet, so a remaining balance would be a guess. */}
              <Text style={styles.heroSub}>
                {total.credit.toLocaleString('en-AU')} g of print credit issued
              </Text>
            </View>

            <Text style={styles.eyebrow}>Badges</Text>
            {badges(total.grams).map((b, i) => (
              <View key={b.label} style={[styles.badgeRow, b.earned && styles.badgeEarned]}>
                <Ionicons
                  name={BADGE_ICONS[i]}
                  size={22}
                  color={b.earned ? theme.colors.ink : theme.colors.muted}
                />
                <View style={styles.flex}>
                  <Text style={[styles.badgeLabel, !b.earned && styles.mutedText]}>{b.label}</Text>
                  <Text style={styles.meta}>{b.sub}</Text>
                </View>
              </View>
            ))}

            <Text style={styles.eyebrow}>Your drop-offs</Text>
            {drops.length === 0 ? (
              <Text style={styles.emptyLine}>Nothing yet. Two kilos is the smallest useful drop.</Text>
            ) : (
              drops.map((d) => (
                <View key={d.id} style={styles.dropRow}>
                  <View style={styles.flex}>
                    <Text style={styles.dropTitle}>
                      {kg(d.weighed_grams ?? d.estimated_grams)} {d.material}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {nameOf(d.org_id)} · {date(d.created_at)}
                    </Text>
                  </View>
                  <Badge status={DROPOFF_PILL[d.status].badge} label={DROPOFF_PILL[d.status].label} />
                  <Text style={styles.grams}>
                    {d.status === 'received' && d.credit_grams !== null ? `+${d.credit_grams} g` : '—'}
                  </Text>
                </View>
              ))
            )}

            <Text style={styles.eyebrow}>Who can take plastic</Text>
            {open.length === 0 ? (
              <Text style={styles.emptyLine}>
                No organisation is taking plastic right now. Each one publishes what it can take,
                so this fills up as they do.
              </Text>
            ) : (
              open.map((o, i) => (
                <Card key={o.id} style={styles.orgCard}>
                  <View style={styles.orgHead}>
                    <View style={[styles.tile, { backgroundColor: TINTS[i % TINTS.length] }]}>
                      <Text style={styles.tileText}>{initials(o.name)}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.orgName}>{o.name}</Text>
                      {place(o) ? <Text style={styles.meta}>{place(o)}</Text> : null}
                    </View>
                  </View>
                  <Fact term="Takes" value={(o.recycling_materials ?? []).join(', ')} />
                  <Fact term="Per drop" value={`From ${MIN_DROPOFF_GRAMS / 1000} kg`} />
                  <Fact term="You get" value="Print credit" />
                  {o.recycling_note ? <Fact term="When" value={o.recycling_note} quiet /> : null}
                  <Button
                    label="Book a drop-off here"
                    variant="secondary"
                    accessibilityLabel={`Book a drop-off at ${o.name}`}
                    onPress={() => {
                      setBooked(null)
                      setBookingAt(o)
                    }}
                  />
                </Card>
              ))
            )}
          </>
        )}

        <View style={styles.amber}>
          <Ionicons name="scale-outline" size={16} color={theme.colors.ink} />
          <Text style={styles.amberText}>
            Credit is issued by the organisation at the door, against a real weight. You cannot
            claim it yourself and it cannot be transferred.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  )
}

function Fact({ term, value, quiet }: { term: string; value: string; quiet?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factTerm}>{term}</Text>
      <Text style={[styles.factValue, quiet && styles.factQuiet]}>{value}</Text>
    </View>
  )
}

function BookDropoff({
  org,
  onBack,
  onBooked,
}: {
  org: TakerOrg
  onBack: () => void
  onBooked: (line: string) => void
}) {
  const materials = org.recycling_materials ?? []
  const [amount, setAmount] = useState('')
  const [material, setMaterial] = useState(materials[0] ?? '')
  const [ticked, setTicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grams = kgToGrams(amount)
  const problem = bookingProblem({ grams, material, ticked: ticked.length })
  const heavyEnough = grams !== null && grams >= MIN_DROPOFF_GRAMS
  const toggle = (line: string) =>
    setTicked((t) => (t.includes(line) ? t.filter((l) => l !== line) : [...t, line]))

  async function submit() {
    if (problem || grams === null) return
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/organizations/${org.id}/recycling`, {
        material,
        estimated_grams: grams,
        condition_declared: true,
        // Which wording was on screen — 063 stores it, and the API refuses a
        // version that is not current rather than trusting this one.
        declaration_version: DECLARATION_VERSION,
        note: note.trim(),
      })
      onBooked(`Booked — ${org.name} expects about ${kg(grams)}.`)
    } catch (err) {
      setError(apiMessage(err, 'That did not book. Try once more.'))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.backPill}>
          <Ionicons name="arrow-back" size={15} color={theme.colors.ink} />
          <Text style={styles.backText}>All organisations</Text>
        </Pressable>

        <View>
          <Text style={styles.bookTitle}>Drop-off at {org.name}</Text>
          <Text style={styles.meta}>
            {[org.recycling_note, `From ${MIN_DROPOFF_GRAMS / 1000} kg a drop`].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <View>
          <Text style={styles.label}>How much, roughly?</Text>
          <View style={styles.kgRow}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="2.0"
              placeholderTextColor={theme.colors.muted}
              keyboardType="decimal-pad"
              accessibilityLabel="How much, roughly, in kilograms"
              style={styles.kgInput}
            />
            <Text style={styles.kgUnit}>kg</Text>
          </View>
          <Text style={styles.help}>
            {grams !== null && grams > 0 && grams < MIN_DROPOFF_GRAMS
              ? `Under the ${MIN_DROPOFF_GRAMS / 1000} kg minimum — hold on to it.`
              : `At least ${MIN_DROPOFF_GRAMS / 1000} kg. They weigh it again at the door — this is just so they can plan.`}
          </Text>
        </View>

        <View>
          <Text style={styles.label}>Which polymer?</Text>
          <View accessibilityRole="radiogroup" style={styles.chips}>
            {materials.map((m) => (
              <Chip key={m} label={m} role="radio" active={material === m} onPress={() => setMaterial(m)} />
            ))}
          </View>
          <Text style={styles.help}>One polymer per drop. Mixed bags cannot be extruded.</Text>
        </View>

        <View>
          <View style={styles.declHead}>
            <Text style={styles.label}>
              Your declaration <Text style={styles.required}>— all seven</Text>
            </Text>
            <Text style={styles.meta} accessibilityLiveRegion="polite">
              {ticked.length} of {RECYCLING_DECLARATION.length}
            </Text>
          </View>
          {RECYCLING_DECLARATION.map((line, i) => {
            const on = ticked.includes(line)
            return (
              <Pressable
                key={line}
                onPress={() => toggle(line)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={line}
                style={[styles.declRow, on && styles.declOn]}
              >
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={21}
                  color={theme.colors.primaryDark}
                />
                <Ionicons name={DECL_ICONS[i]} size={18} color={theme.colors.primaryDark} />
                <Text style={styles.declText}>{line}</Text>
              </Pressable>
            )
          })}
          <Text style={styles.help}>
            One contaminated bag can ruin a whole extruder run. A batch that turns up
            contaminated is refused at the door and nothing is credited.
          </Text>
        </View>

        <TextField
          label="Anything they should know (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
        />

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Worth roughly</Text>
          <Text style={styles.worth}>
            {heavyEnough && grams !== null
              ? `${estimatedCreditGrams(grams).toLocaleString('en-AU')} g`
              : '—'}
          </Text>
          <Text style={styles.heroLine}>
            {heavyEnough
              ? `About three quarters of what you bring becomes filament. ${org.name} issues it after they weigh it.`
              : `Enter a weight of at least ${MIN_DROPOFF_GRAMS / 1000} kg to see what it is worth.`}
          </Text>
        </View>

        <ErrorRow message={error} />
        <Button label="Book the drop-off" onPress={submit} disabled={!!problem} loading={busy} />
        <Text style={[styles.help, styles.centerText]}>
          {problem ?? 'Booking tells them to expect you. No credit exists until they weigh it.'}
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(3), paddingBottom: theme.spacing(10) },
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', gap: theme.spacing(2) },
  centerText: { textAlign: 'center' },
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  mutedText: { color: theme.colors.muted },
  hero: { padding: theme.spacing(5), borderRadius: 22, backgroundColor: theme.colors.mintSoft, gap: 4 },
  heroEyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 11.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: theme.colors.ink,
    opacity: 0.75,
  },
  heroNumber: { fontFamily: theme.fonts.display, fontSize: 44, lineHeight: 50, color: theme.colors.ink },
  heroUnit: { fontSize: 20 },
  heroSub: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.ink, marginTop: 4 },
  heroLine: { fontFamily: theme.fonts.regular, fontSize: 13, lineHeight: 19, color: theme.colors.ink, marginTop: 4 },
  worth: { fontFamily: theme.fonts.display, fontSize: 28, lineHeight: 34, color: theme.colors.ink },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSunken,
  },
  badgeEarned: { backgroundColor: theme.colors.mintSoft, borderColor: theme.colors.success },
  badgeLabel: { fontFamily: theme.fonts.black, fontSize: 14, color: theme.colors.ink },
  emptyLine: {
    padding: theme.spacing(4),
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceSunken,
    textAlign: 'center',
    fontFamily: theme.fonts.regular,
    fontSize: 13.5,
    color: theme.colors.muted,
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  dropTitle: { fontFamily: theme.fonts.black, fontSize: 13.5, color: theme.colors.ink },
  grams: { fontFamily: theme.fonts.numeral, fontSize: 13, color: theme.colors.ink, fontVariant: ['tabular-nums'] },
  orgCard: { padding: theme.spacing(4), gap: 8 },
  orgHead: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  tile: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: theme.fonts.black, fontSize: 13, color: theme.colors.ink },
  orgName: { fontFamily: theme.fonts.display, fontSize: 16, color: theme.colors.ink },
  fact: { flexDirection: 'row', gap: 12 },
  factTerm: { width: 64, fontFamily: theme.fonts.bold, fontSize: 12.5, color: theme.colors.muted },
  factValue: { flex: 1, fontFamily: theme.fonts.black, fontSize: 12.5, color: theme.colors.ink },
  factQuiet: { fontFamily: theme.fonts.semiBold, color: theme.colors.muted },
  amber: {
    flexDirection: 'row',
    gap: 6,
    padding: 14,
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.honeySoft,
    marginTop: theme.spacing(1),
  },
  amberText: { flex: 1, fontFamily: theme.fonts.regular, fontSize: 13, lineHeight: 19, color: theme.colors.ink },
  bookedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.mintSoft,
  },
  bookedText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 13.5, color: theme.colors.ink },
  backPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backText: { fontFamily: theme.fonts.black, fontSize: 13, color: theme.colors.ink },
  bookTitle: { fontFamily: theme.fonts.display, fontSize: 20, lineHeight: 26, color: theme.colors.ink },
  label: { fontFamily: theme.fonts.black, fontSize: 13.5, color: theme.colors.ink, marginBottom: 6 },
  help: { fontFamily: theme.fonts.regular, fontSize: 12.5, lineHeight: 18, color: theme.colors.muted, marginTop: 6 },
  kgRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kgInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    fontFamily: theme.fonts.numeral,
    fontSize: 17,
    color: theme.colors.ink,
  },
  kgUnit: { fontFamily: theme.fonts.black, fontSize: 15, color: theme.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  declHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  required: { color: theme.colors.apricot },
  declRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 48,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 7,
    borderRadius: theme.radii.field,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  declOn: { borderColor: theme.colors.success, backgroundColor: theme.colors.mintSoft },
  declText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 13.5, lineHeight: 18, color: theme.colors.ink },
})

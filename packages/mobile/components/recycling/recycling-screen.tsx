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
 * Unspent credit comes from the API's balance (114); nothing here computes it —
 * the "worth roughly" panel is labelled an estimate for that reason.
 * The photo is uploaded first (112) and the booking sends its path.
 *
 * Every field the board draws on a recycler's card has a column (059, 113);
 * `recycling_note` stays as free text below them.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Image, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import type { RecyclingCredit, RecyclingDropoff, RecyclingGives } from '@splat-connect/types'
import {
  DECLARATION_VERSION,
  MIN_DROPOFF_GRAMS,
  RECYCLING_DECLARATION,
  estimatedCreditGrams,
  apiMessage,
  initials,
  kgToGrams,
  recyclingPerDrop,
} from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { uploadFile } from '../../lib/upload'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import {
  DROPOFF_PILL,
  badges,
  bookingProblem,
  diverted,
  kg,
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
import { ErrorRow } from '../ui/ErrorRow'

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

// MB's card words for 113's recycling_gives.
const GIVES_CARD: Record<RecyclingGives, string> = {
  credit: 'Print credit',
  spool: 'A spool back',
  either: 'Credit or a spool',
}
const when = (o: TakerOrg) => [o.recycling_hours, o.recycling_door].filter(Boolean).join(' · ')

export function RecyclingScreen() {
  const { caps } = useCapabilities()
  const me = caps?.profile.id
  const [orgs, setOrgs] = useState<TakerOrg[]>([])
  const [drops, setDrops] = useState<RecyclingDropoff[]>([])
  const [credit, setCredit] = useState<RecyclingCredit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [bookingAt, setBookingAt] = useState<TakerOrg | null>(null)
  const [booked, setBooked] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Signed out there is nothing to fetch — say so rather than spin forever.
    if (!me) {
      setLoading(false)
      return
    }
    try {
      const [all, mine, c] = await Promise.all([
        apiClient.get<TakerOrg[]>('/api/public/organizations'),
        apiClient.get<RecyclingDropoff[]>('/api/organizations/recycling/mine'),
        apiClient.get<RecyclingCredit[]>('/api/organizations/recycling/credit').catch(() => [] as RecyclingCredit[]),
      ])
      setOrgs(all)
      setDrops(mine)
      setCredit(c)
      setLoadError(false)
    } catch (err) {
      console.error('[RecyclingScreen] load failed:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [me])

  async function cancel(d: RecyclingDropoff) {
    try {
      const fresh = await apiClient.post<RecyclingDropoff>(
        `/api/organizations/${d.org_id}/recycling/${d.id}/cancel`,
        {}
      )
      setDrops((cur) => cur.map((x) => (x.id === d.id ? { ...x, ...fresh } : x)))
    } catch (err) {
      console.error('[RecyclingScreen] cancel failed:', err)
      load()
    }
  }

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
          <View testID="recycling-skeleton">
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
              <Text style={styles.heroSub}>
                {credit.reduce((n, c) => n + c.grams, 0).toLocaleString('en-AU')} g of print credit unspent
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
                  {d.status === 'booked' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel the ${d.material} drop-off`}
                      onPress={() => cancel(d)}
                      hitSlop={8}
                    >
                      <Text style={styles.cancel}>Cancel</Text>
                    </Pressable>
                  ) : null}
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
                  <Fact
                    term="Takes"
                    value={[(o.recycling_materials ?? []).join(', '), (o.recycling_forms ?? []).join(', ')].filter(Boolean).join(' · ')}
                  />
                  {(o.recycling_machines ?? []).length ? <Fact term="Machines" value={o.recycling_machines!.join(' · ')} /> : null}
                  <Fact term="Per drop" value={recyclingPerDrop(o)} />
                  <Fact term="You get" value={GIVES_CARD[o.recycling_gives ?? 'credit']} />
                  {when(o) ? <Fact term="When" value={when(o)} /> : null}
                  {o.recycling_note ? <Text style={styles.meta}>{o.recycling_note}</Text> : null}
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

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factTerm}>{term}</Text>
      <Text style={styles.factValue}>{value}</Text>
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
  const [photo, setPhoto] = useState<{ path: string; uri: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grams = kgToGrams(amount)
  const minGrams = Math.max(MIN_DROPOFF_GRAMS, org.recycling_min_kg != null ? Math.round(org.recycling_min_kg * 1000) : 0)
  const maxGrams = org.recycling_max_kg != null ? Math.round(org.recycling_max_kg * 1000) : null
  const problem = bookingProblem({ grams, material, ticked: ticked.length, minGrams, maxGrams, orgName: org.name })
  const heavyEnough = grams !== null && grams >= minGrams
  const toggle = (line: string) =>
    setTicked((t) => (t.includes(line) ? t.filter((l) => l !== line) : [...t, line]))

  async function addPhoto() {
    if (uploading) return
    setError(null)
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return setError('Photo library access is needed to choose a photo.')
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    const asset = result.canceled ? null : result.assets?.[0]
    if (!asset) return
    setUploading(true)
    try {
      const { path } = await uploadFile(
        '/api/upload/recycling-photo',
        '',
        { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' },
        null
      )
      if (path) setPhoto({ path, uri: asset.uri })
    } catch {
      setError('Could not upload the photo. Please try again.')
    } finally {
      setUploading(false)
    }
  }

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
        ...(photo ? { photo_url: photo.path } : {}),
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
            {[when(org), recyclingPerDrop({ ...org, recycling_turnaround: null })].filter(Boolean).join(' · ')}
          </Text>
          {org.recycling_note ? <Text style={styles.meta}>{org.recycling_note}</Text> : null}
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
              : maxGrams !== null && grams !== null && grams > maxGrams
                ? `${org.name} takes at most ${maxGrams / 1000} kg at once.`
                : maxGrams !== null
                  ? `Between ${minGrams / 1000} and ${maxGrams / 1000} kg. They weigh it again at the door.`
                  : `At least ${minGrams / 1000} kg. They weigh it again at the door — this is just so they can plan.`}
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

        <View>
          <Pressable
            onPress={addPhoto}
            accessibilityRole="button"
            accessibilityLabel="Photo of the sorted plastic"
            accessibilityState={{ busy: uploading }}
            disabled={uploading}
            style={styles.photoSlot}
          >
            {uploading ? (
              <Text style={styles.label}>Uploading…</Text>
            ) : photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photoFill} accessibilityIgnoresInvertColors />
            ) : (
              <>
                <Ionicons name="camera-outline" size={22} color={theme.colors.primaryDark} />
                <Text style={styles.label}>Photo of the sorted plastic</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.help}>Sorted, in the bag or box you will carry it in. It saves an argument at the door.</Text>
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
              : `Enter a weight of at least ${minGrams / 1000} kg to see what it is worth.`}
          </Text>
        </View>

        <ErrorRow message={error} />
        <Button label="Book the drop-off" onPress={submit} disabled={!!problem || uploading} loading={busy} />
        <Text style={[styles.help, styles.centerText]}>
          {problem ?? 'Booking tells them to expect you. No credit exists until they weigh it.'}
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  cancel: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.primary, marginLeft: 8 },
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
  photoSlot: {
    height: 150,
    borderRadius: 18,
    borderWidth: theme.border.hairline,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.accentFaint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  photoFill: { width: '100%', height: '100%' },
})

// packages/mobile/components/recycling/intake-screen.tsx
/**
 * Recycling intake — the organisation's side. Mobile's half of web's
 * dashboard/organisation/recycling: the booked queue first (somebody is at the
 * door), then what the machines take.
 *
 * Credit is minted here, by weighing, and never by the contributor. One
 * weight box; the credit box is prefilled at about three quarters and is the
 * leader's to change (decided 2026-09-30). intakeCredit (@splat-connect/types)
 * is the rule, shared with web; the API repeats the two-kilo floor and the
 * credit-within-weight limit.
 *
 * "What you can take" edits every field the board draws (059's polymers and
 * note, 113's machines, forms, per-drop limits, turnaround, what they get
 * back, hours and door).
 *
 * The first led organisation, as web has it. Title from app/(my)/_layout.tsx.
 */
import { logFailure } from '../../lib/log'
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, TextInput, Image, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { Organization, RecyclingDropoff, RecyclingGives } from '@splat-connect/types'
import { PRINT_MATERIALS, RECYCLING_FORMS, RECYCLING_MACHINES, apiMessage, initials, intakeCredit, weighedInLine } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { DROPOFF_PILL, canDecide, kg } from '../../lib/recycling'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ErrorRow } from '../ui/ErrorRow'
import { FlashLine, useFlash } from '../ui/Flash'

const TINTS = [theme.colors.honeySoft, theme.colors.violetSoft, theme.colors.mintSoft, theme.colors.accentLight]
const date = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

export function IntakeScreen() {
  const { caps, loading: capsLoading } = useCapabilities()
  const orgId = caps?.ledOrgs[0]?.id
  const [org, setOrg] = useState<Organization | null>(null)
  const [drops, setDrops] = useState<RecyclingDropoff[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [flash, setFlash] = useFlash()

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      const [o, d] = await Promise.all([
        apiClient.get<Organization>(`/api/organizations/${orgId}`),
        apiClient.get<RecyclingDropoff[]>(`/api/organizations/${orgId}/recycling`),
      ])
      // Who is at the door: the API names each contributor for the org's
      // leaders, public profile or not.
      const found: Record<string, string> = {}
      for (const x of d) if (x.contributor_name) found[x.contributor_id] = x.contributor_name
      setOrg(o)
      setDrops(d)
      setNames(found)
      setLoadError(false)
    } catch (err) {
      logFailure('[IntakeScreen] load failed:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  if (capsLoading) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (!orgId) {
    return (
      <Screen>
        <EmptyState
          icon="business-outline"
          title="This screen belongs to organisation leaders."
          hint="When an organisation makes you a leader, its recycling intake shows up here."
        />
      </Screen>
    )
  }

  const booked = drops.filter(canDecide)
  const settled = drops.filter((d) => !canDecide(d))
  const nameOf = (d: RecyclingDropoff) => names[d.contributor_id] ?? 'A contributor'

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.lead}>
          Weigh what turns up and the credit is issued against that number. A contributor cannot
          issue their own — this screen is the only place it is minted.
        </Text>
        <FlashLine message={flash} />

        {loading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <ErrorRow message="Couldn't load your intake — try again." />
            <Button label="Try again" variant="secondary" onPress={load} />
          </View>
        ) : (
          <>
            <Text style={styles.eyebrow}>Booked in ({booked.length})</Text>
            {booked.length === 0 ? (
              <Text style={styles.empty}>Nothing booked in right now.</Text>
            ) : (
              booked.map((d, i) => (
                <BookedRow
                  key={d.id}
                  orgId={orgId}
                  dropoff={d}
                  name={nameOf(d)}
                  tint={TINTS[i % TINTS.length]}
                  onDone={(line) => {
                    if (line) setFlash(line)
                    load()
                  }}
                />
              ))
            )}

            {settled.length ? (
              <>
                <Text style={styles.eyebrow}>Weighed in</Text>
                {settled.map((d, i) => (
                  <View key={d.id} style={styles.settledRow}>
                    <Avatar name={nameOf(d)} tint={TINTS[i % TINTS.length]} />
                    <View style={styles.flex}>
                      <Text style={styles.who}>{nameOf(d)}</Text>
                      <Text style={styles.meta}>
                        {d.status === 'received' && d.weighed_grams !== null && d.credit_grams !== null
                          ? `Weighed ${kg(d.weighed_grams)} · credited ${d.credit_grams.toLocaleString('en-AU')} g`
                          : `${kg(d.estimated_grams)} declared`}
                        {` · ${d.material}`}
                      </Text>
                    </View>
                    <Badge status={DROPOFF_PILL[d.status].badge} label={DROPOFF_PILL[d.status].label} />
                  </View>
                ))}
              </>
            ) : null}

            <Text style={styles.eyebrow}>What you can take</Text>
            <Text style={styles.sub}>
              Contributors see this before they pack a box. Every unlisted item is one somebody
              picks out by hand.
            </Text>
            {org ? <WhatYouTake org={org} /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

function Avatar({ name, tint }: { name: string; tint: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: tint }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.avatarText}>{initials(name)}</Text>
    </View>
  )
}

function NumberBox({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: 'kg' | 'g'
  value: string
  onChange: (v: string) => void
}) {
  return (
    <View style={styles.kgBox}>
      <Text style={styles.kgLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={unit === 'kg' ? '0.0' : '0'}
        placeholderTextColor={theme.colors.muted}
        keyboardType={unit === 'kg' ? 'decimal-pad' : 'number-pad'}
        accessibilityLabel={`${label}, in ${unit === 'kg' ? 'kilograms' : 'grams'}`}
        style={styles.kgInput}
      />
      <Text style={styles.kgLabel}>{unit}</Text>
    </View>
  )
}

function BookedRow({
  orgId,
  dropoff,
  name,
  tint,
  onDone,
}: {
  orgId: string
  dropoff: RecyclingDropoff
  name: string
  tint: string
  onDone: (line?: string) => void
}) {
  const [weighed, setWeighed] = useState('')
  // null until the leader types in the credit box: until then it follows the weight.
  const [credit, setCredit] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = intakeCredit(weighed, credit)
  const shownCredit = credit ?? (check.ok ? String(check.credit_grams) : '')

  async function decide(status: 'received' | 'declined') {
    if (status === 'received' && !check.ok) {
      setError(check.line)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiClient.patch(`/api/organizations/${orgId}/recycling/${dropoff.id}`, {
        status,
        ...(status === 'received' && check.ok
          ? { weighed_grams: check.weighed_grams, credit_grams: check.credit_grams }
          : {}),
      })
      onDone(status === 'received' && check.ok ? weighedInLine(check.weighed_grams, check.credit_grams, name) : undefined)
    } catch (err) {
      setError(apiMessage(err, 'That did not save. Check your connection and try again.'))
      setBusy(false)
    }
  }

  return (
    <Card style={styles.row}>
      <View style={styles.rowHead}>
        <Avatar name={name} tint={tint} />
        <View style={styles.flex}>
          <Text style={styles.who}>{name}</Text>
          <Text style={styles.meta}>
            {kg(dropoff.estimated_grams)} declared · {dropoff.material} · Booked {date(dropoff.created_at)}
          </Text>
        </View>
      </View>
      {dropoff.note ? <Text style={styles.note}>{dropoff.note}</Text> : null}
      {dropoff.photo_signed_url ? (
        <Image
          source={{ uri: dropoff.photo_signed_url }}
          accessibilityLabel="Photo of the sorted plastic"
          style={styles.photo}
        />
      ) : null}
      <View style={styles.kgRow}>
        <NumberBox label="Actual" unit="kg" value={weighed} onChange={setWeighed} />
        <NumberBox label="Credit" unit="g" value={shownCredit} onChange={setCredit} />
      </View>
      <Text style={styles.meta}>{check.line}</Text>
      <ErrorRow message={error} />
      <View style={styles.actions}>
        <Button
          label="Contaminated"
          variant="secondary"
          accessibilityLabel={`Turn away ${name}'s drop-off as contaminated`}
          onPress={() => decide('declined')}
          disabled={busy}
          style={styles.decline}
        />
        <Button
          label="Weigh and credit"
          accessibilityLabel={`Weigh and credit ${name}'s drop-off`}
          onPress={() => decide('received')}
          disabled={busy || !check.ok}
          loading={busy}
          style={styles.confirm}
        />
      </View>
    </Card>
  )
}

// MB's editor words for 113's recycling_gives.
const GIVES_EDIT: Array<[RecyclingGives, string]> = [
  ['credit', 'Print credit'],
  ['spool', 'A spool back'],
  ['either', 'Either'],
]
const BAD_KG = 'Per drop is between 2 and 1000 kg, to one decimal place.'
/** '' is "not said"; anything else must read as kilos to one decimal. */
const kgValue = (text: string): number | null | undefined => {
  const t = text.trim()
  if (!t) return null
  return /^\d{1,4}(\.\d)?$/.test(t) ? Number(t) : undefined
}

function ChipSet({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((m) => {
          const on = value.includes(m)
          return <Chip key={m} label={m} active={on} onPress={() => onChange(on ? value.filter((x) => x !== m) : [...value, m])} />
        })}
      </View>
    </View>
  )
}

function WhatYouTake({ org }: { org: Organization }) {
  const [materials, setMaterials] = useState<string[]>(org.recycling_materials ?? [])
  const [machines, setMachines] = useState<string[]>(org.recycling_machines ?? [])
  const [forms, setForms] = useState<string[]>(org.recycling_forms ?? [])
  const [min, setMin] = useState(org.recycling_min_kg != null ? String(org.recycling_min_kg) : '')
  const [max, setMax] = useState(org.recycling_max_kg != null ? String(org.recycling_max_kg) : '')
  const [turnaround, setTurnaround] = useState(org.recycling_turnaround ?? '')
  const [gives, setGives] = useState<RecyclingGives>(org.recycling_gives ?? 'credit')
  const [hours, setHours] = useState(org.recycling_hours ?? '')
  const [door, setDoor] = useState(org.recycling_door ?? '')
  const [note, setNote] = useState(org.recycling_note ?? '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  // Whatever they already publish stays pickable even if it is not a print
  // material — a leader should be able to untick "HDPE", not be stuck with it.
  const polymers = [...new Set([...PRINT_MATERIALS, ...materials])]

  async function save() {
    const minKg = kgValue(min)
    const maxKg = kgValue(max)
    if (minKg === undefined || maxKg === undefined) return setStatus({ ok: false, text: BAD_KG })
    setBusy(true)
    setStatus(null)
    try {
      await apiClient.patch(`/api/organizations/${org.id}/profile`, {
        recycling_materials: materials,
        recycling_note: note,
        recycling_machines: machines,
        recycling_forms: forms,
        recycling_min_kg: minKg,
        recycling_max_kg: maxKg,
        recycling_turnaround: turnaround,
        recycling_gives: gives,
        recycling_hours: hours,
        recycling_door: door,
      })
      setStatus({ ok: true, text: 'Saved — contributors see this now.' })
    } catch (err) {
      setStatus({ ok: false, text: apiMessage(err, 'That did not save. Try once more.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={styles.row}>
      <ChipSet label="Machines" options={RECYCLING_MACHINES} value={machines} onChange={setMachines} />
      <ChipSet label="Polymers" options={polymers} value={materials} onChange={setMaterials} />
      <Text style={styles.meta}>
        Leave it empty if you do not take drop-offs — nobody can book one until something is on
        this list.
      </Text>
      <ChipSet label="In what form" options={RECYCLING_FORMS} value={forms} onChange={setForms} />
      <View style={styles.kgRow}>
        <View style={styles.flex}>
          <TextField label="Minimum" accessibilityLabel="Minimum" value={min} onChangeText={setMin} keyboardType="decimal-pad" placeholder="2" />
        </View>
        <View style={styles.flex}>
          <TextField label="Maximum" accessibilityLabel="Maximum" value={max} onChangeText={setMax} keyboardType="decimal-pad" />
        </View>
      </View>
      <Text style={styles.meta}>The platform floor is 2 kg. You can ask for more, never less.</Text>
      <TextField label="Turnaround" accessibilityLabel="Turnaround" value={turnaround} onChangeText={setTurnaround} maxLength={60} />
      <View style={styles.group}>
        <Text style={styles.label}>They get back</Text>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {GIVES_EDIT.map(([value, label]) => (
            <Chip key={value} label={label} role="radio" active={gives === value} onPress={() => setGives(value)} />
          ))}
        </View>
      </View>
      <TextField label="Drop-off hours" accessibilityLabel="Drop-off hours" value={hours} onChangeText={setHours} maxLength={80} />
      <TextField label="Which door" accessibilityLabel="Which door" value={door} onChangeText={setDoor} maxLength={120} />
      <TextField
        label="How you want it brought"
        accessibilityLabel="How you want it brought"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
        placeholder="Clean, dry, sorted."
      />
      {status ? (
        status.ok ? (
          <Text style={styles.meta} accessibilityRole="alert">
            {status.text}
          </Text>
        ) : (
          <ErrorRow message={status.text} />
        )
      ) : null}
      <Button label="Save what you take" onPress={save} loading={busy} />
    </Card>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(3), paddingBottom: theme.spacing(10) },
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', gap: theme.spacing(2) },
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  sub: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19, marginTop: -6 },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
  empty: {
    padding: theme.spacing(6),
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    textAlign: 'center',
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  row: { padding: theme.spacing(4), gap: 11 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  who: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, lineHeight: 18, color: theme.colors.muted },
  note: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, lineHeight: 19, color: theme.colors.ink },
  photo: { width: '100%', height: 180, borderRadius: 18 },
  kgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kgBox: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kgLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  kgInput: {
    width: 86,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    fontFamily: theme.fonts.numeral,
    fontSize: theme.type.body,
    color: theme.colors.ink,
  },
  actions: { flexDirection: 'row', gap: 8 },
  decline: { flex: 1, paddingHorizontal: theme.spacing(2) },
  confirm: { flex: 1.4, paddingHorizontal: theme.spacing(2) },
  settledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  label: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  group: { gap: 8 },
})

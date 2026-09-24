// packages/mobile/components/recycling/intake-screen.tsx
/**
 * Recycling intake — the organisation's side. Mobile's half of web's
 * dashboard/organisation/recycling: the booked queue first (somebody is at the
 * door), then what the machines take.
 *
 * Credit is minted here, by weighing, and never by the contributor. Where the
 * board computes the credit from the weight, this row asks for both numbers, as
 * web does: the yield is the leader's to apply, and "about three quarters" is a
 * hint beside the box rather than a constant in a ledger. The API refuses a
 * credit larger than the weight; intakeProblem refuses it first.
 *
 * "What you can take" edits only the two fields that have columns (059's
 * recycling_materials and recycling_note). The board's machines, forms, min,
 * max, turnaround, hours and door have nowhere to be stored; the note carries
 * them, as web's what-you-take.tsx decided.
 *
 * The first led organisation, as web has it. Title from app/(my)/_layout.tsx.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, TextInput, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { Organization, RecyclingDropoff } from '@splat-connect/types'
import { PRINT_MATERIALS, estimatedCreditGrams, apiMessage, initials, kgToGrams } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { DROPOFF_PILL, canDecide, intakeProblem, kg } from '../../lib/recycling'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ErrorRow } from '../auth-screen'

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
      console.error('[IntakeScreen] load failed:', err)
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
                  onDone={load}
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

function KgBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.kgBox}>
      <Text style={styles.kgLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0.0"
        placeholderTextColor={theme.colors.muted}
        keyboardType="decimal-pad"
        accessibilityLabel={`${label}, in kilograms`}
        style={styles.kgInput}
      />
      <Text style={styles.kgLabel}>kg</Text>
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
  onDone: () => void
}) {
  const [weighed, setWeighed] = useState('')
  const [credit, setCredit] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = intakeProblem(weighed, credit)
  const weighedGrams = kgToGrams(weighed)

  async function decide(status: 'received' | 'declined') {
    if (status === 'received' && !check.ok) {
      setError(check.message)
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
      onDone()
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
      <View style={styles.kgRow}>
        <KgBox label="Actual" value={weighed} onChange={setWeighed} />
        <KgBox label="Credit" value={credit} onChange={setCredit} />
      </View>
      <Text style={styles.meta}>
        {weighedGrams
          ? `About ${estimatedCreditGrams(weighedGrams).toLocaleString('en-AU')} g is typical — the credit is the number you decide.`
          : 'Weigh it to see the typical credit.'}
      </Text>
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

function WhatYouTake({ org }: { org: Organization }) {
  const [materials, setMaterials] = useState<string[]>(org.recycling_materials ?? [])
  const [note, setNote] = useState(org.recycling_note ?? '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  // Whatever they already publish stays pickable even if it is not a print
  // material — a leader should be able to untick "HDPE", not be stuck with it.
  const options = [...new Set([...PRINT_MATERIALS, ...materials])]

  async function save() {
    setBusy(true)
    setStatus(null)
    try {
      await apiClient.patch(`/api/organizations/${org.id}/profile`, {
        recycling_materials: materials,
        recycling_note: note,
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
      <Text style={styles.label}>Polymers</Text>
      <View style={styles.chips}>
        {options.map((m) => {
          const on = materials.includes(m)
          return (
            <Chip
              key={m}
              label={m}
              active={on}
              onPress={() => setMaterials(on ? materials.filter((x) => x !== m) : [...materials, m])}
            />
          )
        })}
      </View>
      <Text style={styles.meta}>
        Leave it empty if you do not take drop-offs — nobody can book one until something is on
        this list.
      </Text>
      <TextField
        label="How you want it brought"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
        placeholder="Clean, dry, sorted. Tuesday and Thursday, 9am–4pm, loading door on the lane."
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
  sub: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.muted, lineHeight: 19, marginTop: -6 },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
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
    fontSize: 13.5,
    color: theme.colors.muted,
  },
  row: { padding: theme.spacing(4), gap: 11 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: theme.fonts.black, fontSize: 13, color: theme.colors.ink },
  who: { fontFamily: theme.fonts.black, fontSize: 15, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: 12.5, lineHeight: 18, color: theme.colors.muted },
  note: { fontFamily: theme.fonts.regular, fontSize: 13, lineHeight: 19, color: theme.colors.ink },
  kgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kgBox: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kgLabel: { fontFamily: theme.fonts.black, fontSize: 13, color: theme.colors.ink },
  kgInput: {
    width: 86,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    fontFamily: theme.fonts.numeral,
    fontSize: 15,
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
  label: { fontFamily: theme.fonts.black, fontSize: 13.5, color: theme.colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
})

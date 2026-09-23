// packages/mobile/components/printing/offer-screen.tsx
/**
 * Print for others — the same three tabs as web's /dashboard/printers:
 * requests waiting on you, jobs on the bed, and your machines.
 *
 * The machines are yours and your organisations' together (/api/printers/mine
 * returns both). That is what makes the board's machine picker reachable: a
 * request to an organisation that runs more than one printer lets a leader
 * choose which bench takes it, fit-checked against the parts' material and each
 * machine's free slots, with the best one preselected. A contributor with one
 * printer never sees it.
 *
 * Accept and decline happen on the card. A person's machine needs a pickup
 * address to accept (the API copies it onto the job); it comes from the
 * profile when that is complete, and is asked for inline when it is not.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { PickupAddress, PrinterWithOwner, ToyTransaction, ToyTransactionSummary } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import {
  apiMessage,
  bestMachine,
  jobState,
  JOB_LABEL,
  JOB_TONE,
  machineFit,
  othersLabel,
  partMaterials,
  partsMeta,
  plural,
} from '../../lib/printing'
import { markReady, startPrint } from './actions'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../auth-screen'

type Tab = 'requests' | 'jobs' | 'printers'

const REASONS = ['No PETG on hand', 'Too big for my bed', 'Away for a while', 'Too many jobs already']

const PICKUP_FIELDS = [
  { key: 'pickup_line1', label: 'Street address' },
  { key: 'pickup_suburb', label: 'Suburb' },
  { key: 'pickup_state', label: 'State' },
  { key: 'pickup_postcode', label: 'Postcode' },
] as const

/**
 * `orgId` scopes the screen to one organisation's machines — the board's Print
 * orders ("Print for others, scoped to the organisation"). Without it, every
 * machine the caller can answer for.
 */
export function PrintForOthersScreen({ orgId }: { orgId?: string } = {}) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [tab, setTab] = useState<Tab>('requests')
  const [printers, setPrinters] = useState<PrinterWithOwner[] | null>(null)
  const [jobs, setJobs] = useState<ToyTransactionSummary[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [every, all] = await Promise.all([
        apiClient.get<PrinterWithOwner[]>('/api/printers/mine'),
        apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions'),
      ])
      const mine = orgId ? every.filter((p) => p.owner_org_id === orgId) : every
      const ids = new Set(mine.map((p) => p.id))
      // Jobs ON these machines — never ones this account asked for, which live
      // on My print requests with different controls entirely.
      const onMine = all.filter((t) => t.type === 'print' && t.printer_id !== null && ids.has(t.printer_id))
      setPrinters(mine)
      setJobs(onMine)
      setLoadFailed(false)
    } catch (err) {
      console.error('[PrintForOthersScreen] load failed:', err)
      setLoadFailed(true)
    }
  }, [orgId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  /** One write, then a reload: every action here changes which tab a row is on. */
  async function act(id: string, action: () => Promise<unknown>, after?: () => void) {
    setBusy(id)
    setError(null)
    try {
      await action()
      after?.()
    } catch (err) {
      setError(apiMessage(err, 'That did not go through. Check your connection and try again.'))
    } finally {
      setBusy(null)
      // Also after a failure: a 409 "Another printer has already taken this
      // job" means the row is gone, and leaving it up invites a second tap.
      load()
    }
  }

  if (loadFailed && !printers) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load your printers." hint="Check your connection and try again." />
      </Screen>
    )
  }
  if (!printers || !caps) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  const waiting = jobs.filter((t) => t.status === 'requested')
  const onTheBed = jobs.filter((t) => t.status === 'accepted')
  const done = jobs.filter((t) => t.status !== 'requested' && t.status !== 'accepted')
  const byId = new Map(printers.map((p) => [p.id, p]))
  const { pickup_line1, pickup_suburb, pickup_state, pickup_postcode } = caps.profile
  const savedAddress: PickupAddress | null =
    pickup_line1 && pickup_suburb && pickup_state && pickup_postcode
      ? { pickup_line1, pickup_suburb, pickup_state, pickup_postcode }
      : null

  const TABS: Array<[Tab, string, number]> = [
    ['requests', 'Requests', waiting.length],
    ['jobs', 'Jobs', onTheBed.length],
    ['printers', 'My printers', 0],
  ]

  return (
    <Screen>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {TABS.map(([key, label, count]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            accessibilityLabel={count ? `${label}, ${count}` : label}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            {count ? <Text style={styles.count}>{count}</Text> : null}
          </Pressable>
        ))}
      </View>
      <ErrorRow message={error} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {tab === 'requests' ? (
          waiting.length === 0 ? (
            <EmptyState
              icon="moon-outline"
              title="Nothing waiting"
              hint="Requests that match your materials and bed size land here. You will get a notification."
            />
          ) : (
            waiting.map((tx) => (
              <IncomingCard
                key={tx.id}
                tx={tx}
                groupSize={tx.print_group_size ?? 1}
                machines={tx.owner_org_id ? printers.filter((p) => p.owner_org_id === tx.owner_org_id) : []}
                jobPrinter={tx.printer_id ? byId.get(tx.printer_id) ?? null : null}
                savedAddress={savedAddress}
                busy={busy === tx.id}
                onAccept={(body) =>
                  act(
                    tx.id,
                    () => apiClient.post<ToyTransaction>(`/api/toy-transactions/${tx.id}/accept`, body),
                    () => setTab('jobs')
                  )
                }
                onDecline={(reason) =>
                  act(tx.id, () => apiClient.post<ToyTransaction>(`/api/toy-transactions/${tx.id}/reject`, { reason }))
                }
              />
            ))
          )
        ) : null}

        {tab === 'jobs' ? (
          <>
            {onTheBed.length === 0 ? (
              <EmptyState icon="print-outline" title="No live jobs" hint="Accept a request and it appears here." />
            ) : (
              onTheBed.map((tx) => {
                const state = jobState(tx)
                const parts = (tx.print_files ?? []).reduce((n, f) => n + f.quantity, 0)
                return (
                  <Card key={tx.id} style={styles.card}>
                    <Pressable accessibilityRole="button" onPress={() => router.push(`/printing/jobs/${tx.id}`)} style={styles.cardTop}>
                      <View style={styles.flex}>
                        <Text style={styles.title}>{tx.tutorial_title ?? 'A print job'}</Text>
                        <Text style={styles.meta}>
                          {plural(parts, 'part')} · for {tx.other_party_name}
                        </Text>
                        {tx.printer_id && byId.get(tx.printer_id) ? (
                          <Text style={styles.meta}>On {byId.get(tx.printer_id)!.name}</Text>
                        ) : null}
                      </View>
                      <Badge status={JOB_TONE[state]} label={JOB_LABEL[state]} />
                    </Pressable>
                    {state === 'accepted' ? (
                      <Button label="Started printing" loading={busy === tx.id} onPress={() => act(tx.id, () => startPrint(tx.id))} />
                    ) : state === 'printing' ? (
                      <Button label="Mark ready for pickup" loading={busy === tx.id} onPress={() => act(tx.id, () => markReady(tx.id))} />
                    ) : (
                      <>
                        <Text style={styles.strong}>Waiting for pickup.</Text>
                        <Text style={styles.meta}>
                          The requester has your pickup details and a photo. Read them your code
                          {tx.owner_code ? ` (${tx.owner_code})` : ''} and take theirs on the job page.
                        </Text>
                        <Button label="Open the job" variant="secondary" onPress={() => router.push(`/printing/jobs/${tx.id}`)} />
                      </>
                    )}
                  </Card>
                )
              })
            )}
            {done.length ? (
              <>
                <Text style={styles.eyebrow}>Done</Text>
                {done.map((tx) => {
                  const state = jobState(tx)
                  return (
                    <Pressable
                      key={tx.id}
                      accessibilityRole="button"
                      onPress={() => router.push(`/printing/jobs/${tx.id}`)}
                      style={styles.historyRow}
                    >
                      <View style={styles.flex}>
                        <Text style={styles.strong}>{tx.tutorial_title ?? 'A print job'}</Text>
                        <Text style={styles.meta}>
                          {tx.other_party_name} ·{' '}
                          {new Date(tx.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      <Badge status={JOB_TONE[state]} label={JOB_LABEL[state]} />
                    </Pressable>
                  )
                })}
              </>
            ) : null}
          </>
        ) : null}

        {tab === 'printers' ? (
          <>
            {printers.map((p) => {
              const full = p.open_jobs >= p.capacity
              return (
                <Card key={p.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.flex}>
                      <Text style={styles.title}>{p.name}</Text>
                      <Text style={styles.meta}>
                        {[p.org_name, `${p.bed_x} mm bed`, `${p.open_jobs} of ${p.capacity}${full ? ' · full' : ' used'}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Badge status={p.accepting ? 'completed' : 'withdrawn'} label={p.accepting ? 'Open' : 'Paused'} />
                  </View>
                  <Text style={styles.meta}>Materials: {p.materials.join(', ')}</Text>
                  {p.notes ? <Text style={styles.meta}>{p.notes}</Text> : null}
                  <Button
                    label={p.accepting ? 'Pause' : 'Open to requests'}
                    variant="secondary"
                    loading={busy === p.id}
                    onPress={() => act(p.id, () => apiClient.patch(`/api/printers/${p.id}`, { accepting: !p.accepting }))}
                  />
                </Card>
              )
            })}
            <Button label="Add a printer" onPress={() => router.push('/print-for-others/add')} />
            <View style={styles.note}>
              <Text style={styles.strong}>Going away?</Text>
              <Text style={styles.meta}>Pause a printer and it stops taking requests; open jobs are unaffected.</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function IncomingCard({
  tx,
  groupSize,
  machines,
  jobPrinter,
  savedAddress,
  busy,
  onAccept,
  onDecline,
}: {
  tx: ToyTransactionSummary
  groupSize: number
  /** The organisation's machines when the job went to one; empty for a person. */
  machines: PrinterWithOwner[]
  jobPrinter: PrinterWithOwner | null
  savedAddress: PickupAddress | null
  busy: boolean
  onAccept: (body: object) => void
  onDecline: (reason: string) => void
}) {
  const files = tx.print_files ?? []
  const materials = partMaterials(files)
  const picker = machines.length > 1
  const [machineId, setMachineId] = useState(() => (picker ? bestMachine(machines, materials)?.id : undefined))
  const [declining, setDeclining] = useState(false)
  const [address, setAddress] = useState<Record<string, string> | null>(null)

  const machine = picker ? machines.find((m) => m.id === machineId) : jobPrinter
  const fit = machine ? machineFit(machine, materials) : null
  const acceptLabel = machine
    ? `${fit && !fit.ok && picker ? 'Accept anyway on' : 'Accept on'} ${machine.name}`
    : 'Accept'

  function accept() {
    if (tx.owner_org_id) return onAccept(picker && machineId ? { printer_id: machineId } : {})
    if (savedAddress) return onAccept(savedAddress)
    // No saved address: ask for one here rather than send a request the API
    // will refuse. Kept up on failure so nothing typed is lost.
    if (!address) return setAddress({ pickup_line1: '', pickup_suburb: '', pickup_state: '', pickup_postcode: '' })
    onAccept(address)
  }
  const addressIncomplete = address !== null && PICKUP_FIELDS.some((f) => !address[f.key]?.trim())

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.glyph}>
          <Ionicons name="cube-outline" size={22} color={theme.colors.ink} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{tx.tutorial_title ?? 'A print job'}</Text>
          <Text style={styles.meta}>
            {[plural(files.reduce((n, f) => n + f.quantity, 0), 'part'), partsMeta(files)].filter(Boolean).join(' · ')}
          </Text>
          <Text style={styles.meta}>
            From {tx.requester_suburb ? `a family in ${tx.requester_suburb}` : 'a family'} ·{' '}
            {tx.print_delivery === 'post' ? 'wants it posted' : 'will collect'}
            {tx.print_colour && tx.print_colour !== 'Any colour' ? ` · ${tx.print_colour}` : ''}
          </Text>
        </View>
      </View>
      {tx.print_note ? <Text style={styles.quote}>“{tx.print_note}”</Text> : null}
      <View style={styles.row}>
        <Ionicons name="flash" size={16} color={theme.colors.honey} />
        <Text style={[styles.meta, styles.flex]}>
          {othersLabel(groupSize)}. Settings from the guide{materials.length ? `: ${materials.join(', ')}` : ''}.
        </Text>
      </View>

      {picker ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Which printer takes this job" style={styles.machines}>
          <Text style={styles.eyebrow}>Print on</Text>
          {machines.map((m) => {
            const f = machineFit(m, materials)
            const on = m.id === machineId
            return (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: f.blocked }}
                disabled={f.blocked}
                onPress={() => setMachineId(m.id)}
                style={[styles.machine, on && styles.machineOn, f.blocked && styles.dim]}
              >
                <View style={styles.flex}>
                  <Text style={styles.strong}>{m.name}</Text>
                  <Text style={styles.meta}>
                    {m.materials.join(' · ')} · {m.open_jobs} of {m.capacity} used
                  </Text>
                  <View style={styles.row}>
                    <Badge status={f.ok ? 'completed' : 'requested'} label={f.ok ? 'Fits' : 'Needs a change'} />
                    <Text style={styles.meta}>{f.why}</Text>
                  </View>
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      {address
        ? PICKUP_FIELDS.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              accessibilityLabel={field.label}
              autoComplete="off"
              value={address[field.key]}
              onChangeText={(text) => setAddress({ ...address, [field.key]: text })}
            />
          ))
        : null}

      <Button
        label={acceptLabel}
        loading={busy}
        disabled={busy || tx.blocked_by_rival_accept || addressIncomplete || (picker && !machineId)}
        onPress={accept}
      />
      <Button label="Decline…" variant="secondary" disabled={busy} onPress={() => setDeclining((v) => !v)} />
      {picker && fit ? (
        <Text style={[styles.meta, styles.center]}>
          {fit.ok
            ? 'Lands in this machine’s queue. Other leaders see which bench it is on.'
            : 'This machine is missing something the guide asks for.'}
        </Text>
      ) : null}

      {declining ? (
        <View style={styles.machines}>
          <Text style={styles.eyebrow}>Why? (goes to the requester)</Text>
          <View style={styles.reasons}>
            {REASONS.map((reason) => (
              <Button
                key={reason}
                label={reason}
                variant="secondary"
                disabled={busy}
                onPress={() => onDecline(reason)}
                style={styles.reason}
              />
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceSunken,
    marginBottom: theme.spacing(3),
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: theme.radii.pill,
  },
  tabOn: { backgroundColor: theme.colors.surface, ...theme.shadow(1) },
  tabText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.muted },
  tabTextOn: { fontFamily: theme.fonts.black, color: theme.colors.ink },
  count: {
    fontFamily: theme.fonts.black,
    fontSize: 11,
    color: theme.colors.ink,
    backgroundColor: theme.colors.apricotSoft,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  content: { paddingBottom: theme.spacing(8), gap: theme.spacing(3) },
  card: { gap: theme.spacing(3), padding: theme.spacing(4) },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(3) },
  glyph: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.text },
  strong: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19 },
  quote: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.ink, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), flexWrap: 'wrap' },
  center: { textAlign: 'center' },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  machines: { gap: theme.spacing(2) },
  machine: {
    padding: theme.spacing(3),
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  machineOn: { borderColor: theme.colors.primaryDark, backgroundColor: theme.colors.accentLight },
  dim: { opacity: 0.55 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  reason: { flexGrow: 1, flexBasis: '45%', paddingHorizontal: theme.spacing(3) },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(3),
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surface,
  },
  note: {
    gap: 4,
    padding: theme.spacing(4),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.honeySoft,
  },
})

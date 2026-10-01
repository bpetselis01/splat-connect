// packages/mobile/components/exchanges/cost-panel.tsx
/**
 * The cost panel the two threads share (055/056, on the exchange-costs routes
 * that already exist). SPLAT never handles the money: this is a written record
 * both people see.
 *
 * - 'edit': the maker on a build itemises what they bought and removes their
 *   own lines. POST makes the caller the payee, so every line they add is
 *   theirs to be paid back (or to cover).
 * - 'settle': the family on a build reads the lines and marks the ones they
 *   pay settled. The family settles (spec), so 'edit' has no switch.
 * - 'read': the exchange thread's card — the lines, who pays back, the method.
 *
 * Settling is per line (055); the board's one switch marks every claimed line
 * the viewer pays. The sums are costSummary's (packages/types), the one copy.
 * The board's "Paid forward" has no column and is left out.
 */
import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ExchangeCost, ExchangeSettlement } from '@splat-connect/types'
import { apiMessage, costSummary, dollarsToCents, formatCents } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { ErrorRow } from '../ui/ErrorRow'

type CostLine = Pick<
  ExchangeCost,
  'id' | 'description' | 'amount_cents' | 'claiming' | 'payer_id' | 'payee_id' | 'settled_at' | 'created_by'
>
type Costs = { lines: CostLine[]; settlement: Pick<ExchangeSettlement, 'method'> | null }
export type CostPanelMode = 'edit' | 'settle' | 'read'

function Total({ label, cents, owed }: { label: string; cents: number; owed: boolean }) {
  return (
    <View style={[styles.payBack, owed ? styles.payBackYou : styles.payBackThem]}>
      <Text style={styles.payBackLabel}>{label}</Text>
      <Text style={styles.payBackAmount}>{formatCents(cents)}</Text>
    </View>
  )
}

export function CostPanel({
  transactionId,
  viewerId,
  mode,
  title,
  hint,
}: {
  transactionId: string
  viewerId: string
  mode: CostPanelMode
  title: string
  hint?: string
}) {
  const [costs, setCosts] = useState<Costs | null>(null)
  const [what, setWhat] = useState('')
  const [amount, setAmount] = useState('')
  const [claiming, setClaiming] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Once per screen, not per poll. RLS returns empty arrays to a stranger.
  useEffect(() => {
    let ignore = false
    apiClient
      .get<Costs>(`/api/exchange-costs/${transactionId}`)
      .then((c) => {
        if (!ignore) setCosts(c)
      })
      // Lines are money claims: "Nothing listed" after a failed read would
      // invite the maker to claim the same parts twice.
      .catch(() => {
        if (!ignore) setError('Could not load the costs. Check your connection and try again.')
      })
    return () => {
      ignore = true
    }
  }, [transactionId])

  const lines = costs?.lines ?? []
  const loaded = costs !== null
  if (mode === 'read' && lines.length === 0) return null

  const setLines = (fn: (ls: CostLine[]) => CostLine[]) =>
    setCosts((c) => ({ lines: fn(c?.lines ?? []), settlement: c?.settlement ?? null }))

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(apiMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  async function addLine() {
    const cents = amount.trim() ? dollarsToCents(amount) : 0
    if (cents === null) {
      setError('The amount is dollars, like 6.50.')
      return
    }
    await run(async () => {
      const line = await apiClient.post<CostLine>(`/api/exchange-costs/${transactionId}`, {
        description: what.trim(),
        amount_cents: cents,
        claiming,
      })
      setLines((ls) => [...ls, line])
      setWhat('')
      setAmount('')
    }, 'Could not add that line. Please try again.')
  }

  const removeLine = (line: CostLine) =>
    run(async () => {
      await apiClient.delete(`/api/exchange-costs/${line.id}`)
      setLines((ls) => ls.filter((l) => l.id !== line.id))
    }, 'Could not remove that line. Please try again.')

  // What the viewer pays; a line the maker owes them is theirs to mark, not this switch's.
  const claimed = lines.filter((l) => l.claiming && l.payer_id === viewerId)
  const settled = claimed.length > 0 && claimed.every((l) => l.settled_at)

  const toggleSettled = () =>
    run(async () => {
      const next = !settled
      const results = await Promise.all(
        claimed
          .filter((l) => !!l.settled_at !== next)
          .map((l) =>
            apiClient.patch<{ id: string; settled_at: string | null }>(`/api/exchange-costs/${l.id}/settle`, { settled: next })
          )
      )
      const at = new Map(results.map((r) => [r.id, r.settled_at]))
      setLines((ls) => ls.map((l) => (at.has(l.id) ? { ...l, settled_at: at.get(l.id) ?? null } : l)))
    }, 'Could not save that. Please try again.')

  const { you_pay_cents: youPay, you_get_cents: youGet } = costSummary(lines, viewerId)
  const method = costs?.settlement?.method ?? null

  return (
    <Card style={styles.block}>
      <Text style={styles.eyebrow}>{title}</Text>
      {hint ? <Text style={styles.body}>{hint}</Text> : null}
      {loaded && mode === 'edit' && lines.length === 0 ? (
        <Text style={styles.body}>Nothing listed — add a line for anything you paid for, even if you plan to cover it.</Text>
      ) : null}

      {lines.map((l) => (
        <View key={l.id} style={styles.line}>
          <View style={styles.flex}>
            <Text style={styles.desc}>{l.description}</Text>
            {mode === 'read' ? null : <Text style={styles.mode}>{l.claiming ? 'Claiming back' : 'Covering it'}</Text>}
          </View>
          {/* A covered line costs the reader nothing on an exchange's card (055). */}
          <Text style={styles.amount}>{formatCents(mode === 'read' && !l.claiming ? 0 : l.amount_cents)}</Text>
          {mode === 'edit' && l.created_by === viewerId ? (
            <Pressable
              onPress={() => void removeLine(l)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Remove this line"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {!loaded ? null : mode === 'edit' ? (
        <Total label={youGet > 0 ? 'Asking back' : 'Nothing asked back'} cents={youGet} owed={false} />
      ) : mode === 'settle' ? (
        <Total label={youPay > 0 ? 'You pay back' : 'Nothing to pay'} cents={youPay} owed={youPay > 0} />
      ) : youPay > 0 || youGet > 0 ? (
        <Total label={youPay > 0 ? 'You pay back' : 'They pay you back'} cents={youPay > 0 ? youPay : youGet} owed={youPay > 0} />
      ) : null}

      {method ? (
        <View style={styles.methodRow}>
          <Ionicons name="business-outline" size={15} color={theme.colors.muted} />
          <Text style={styles.body}>{method}</Text>
        </View>
      ) : null}

      {loaded && mode === 'edit' ? (
        <View style={styles.form}>
          <TextField
            label="What the money went on"
            accessibilityLabel="What the money went on"
            placeholder="What did you pay for?"
            value={what}
            onChangeText={setWhat}
          />
          <TextField
            label="Amount in dollars"
            accessibilityLabel="Amount in dollars"
            placeholder="0.00"
            inputMode="decimal"
            value={amount}
            onChangeText={setAmount}
          />
          <View accessibilityRole="radiogroup" style={styles.chips}>
            <Chip role="radio" label="Claiming back" active={claiming} onPress={() => setClaiming(true)} />
            <Chip role="radio" label="Covering it" active={!claiming} onPress={() => setClaiming(false)} />
          </View>
          <Button label="Add a line" variant="secondary" disabled={busy} onPress={() => void addLine()} />
        </View>
      ) : null}

      {mode === 'settle' && claimed.length > 0 ? (
        <View style={styles.form}>
          <Button
            label={settled ? 'Marked as settled' : 'Mark as settled'}
            variant={settled ? 'secondary' : 'primary'}
            disabled={busy}
            onPress={() => void toggleSettled()}
          />
          <Text style={styles.body}>
            {settled ? 'Both of you can see this. Tap to undo if it was early.' : 'Tap only once the money has actually changed hands.'}
          </Text>
        </View>
      ) : null}

      {mode !== 'read' ? (
        <Text style={styles.body}>
          SPLAT does not take payments or a cut. This is a written record both of you can see — you settle it between yourselves.
        </Text>
      ) : null}
      <ErrorRow message={error} />
    </Card>
  )
}

const styles = StyleSheet.create({
  block: { gap: theme.spacing(2), padding: theme.spacing(4), borderRadius: theme.radii.panel },
  eyebrow: { fontFamily: theme.fonts.black, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.ink },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(3) },
  desc: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  mode: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  amount: { fontFamily: theme.fonts.numeral, fontSize: theme.type.label, color: theme.colors.text },
  payBack: { alignSelf: 'flex-start', borderRadius: theme.radii.panel, padding: theme.spacing(3), gap: 2 },
  payBackYou: { backgroundColor: theme.colors.honeySoft },
  payBackThem: { backgroundColor: theme.colors.mintSoft },
  payBackLabel: { fontFamily: theme.fonts.black, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.ink },
  payBackAmount: { fontFamily: theme.fonts.numeral, fontSize: theme.type.title, color: theme.colors.ink },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  form: { gap: theme.spacing(2), marginTop: theme.spacing(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})

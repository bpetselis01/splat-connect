// packages/mobile/components/organisation/sections/org-rates.tsx
// "What you ask families to cover": up to 20 cost lines, why, and how to be paid back.
import { View, Text, StyleSheet } from 'react-native'
import { PAYMENT_METHODS } from '@splat-connect/types'
import { theme } from '../../../lib/theme'
import { MAX_RATE_LINES, type RateDraft } from '../../../lib/org-lists'
import { Card } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/TextField'
import { ListSection } from '../../list/list-kit'
import { toggle } from './toggle'

let next = 0
export const newRateKey = () => `new-rate-${next++}`

export function OrgRates({
  lines,
  onLines,
  note,
  onNote,
  payments,
  onPayments,
}: {
  lines: RateDraft[]
  onLines: (next: RateDraft[]) => void
  note: string
  onNote: (v: string) => void
  payments: string[]
  onPayments: (next: string[]) => void
}) {
  const set = (i: number, patch: Partial<RateDraft>) => onLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  return (
    <>
      <ListSection style={styles.group}>What you ask families to cover</ListSection>
      <Text style={styles.lede}>SPLAT does not take payments or a cut. This is a written record both of you can see. You settle it between yourselves.</Text>
      {lines.map((l, i) => (
        <Card key={l.key} style={styles.card}>
          <TextField label={`Line ${i + 1} description`} value={l.description} maxLength={80} placeholder="PLA filament, per small part" onChangeText={(v) => set(i, { description: v })} />
          <TextField label={`Line ${i + 1} amount in dollars`} value={l.amount} keyboardType="decimal-pad" placeholder="$0" onChangeText={(v) => set(i, { amount: v })} />
          <Chip
            label={l.claiming ? 'Claiming back' : 'Covering it'}
            active={l.claiming}
            onPress={() => set(i, { claiming: !l.claiming })}
          />
          <Button label="Remove" accessibilityLabel={`Remove line ${i + 1}`} variant="danger" onPress={() => onLines(lines.filter((_, j) => j !== i))} />
        </Card>
      ))}
      {lines.length < MAX_RATE_LINES ? (
        <Button
          label="Add a line"
          variant="secondary"
          onPress={() => onLines([...lines, { key: newRateKey(), description: '', amount: '', claiming: true }])}
        />
      ) : (
        <Text style={styles.lede}>Twenty lines is the most a breakdown holds.</Text>
      )}
      <TextField
        label={lines.length > 0 ? 'Why these costs (required)' : 'Why these costs (optional)'}
        hint="Whoever you are asking to pay reads this word for word. Name the material and the rate."
        value={note}
        maxLength={500}
        multiline
        onChangeText={onNote}
      />
      <Text style={styles.small}>How you would like to be paid back</Text>
      <View style={styles.chips}>
        {PAYMENT_METHODS.map((m) => (
          <Chip key={m.value} label={m.label} active={payments.includes(m.value)} onPress={() => onPayments(toggle(payments, m.value))} />
        ))}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  group: { marginTop: theme.spacing(3), marginBottom: 0 },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  card: { padding: 15, gap: theme.spacing(2), borderRadius: theme.radii.panel, ...theme.shadow(1) },
  small: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})

// packages/mobile/components/organisation/sections/org-doors.tsx
// "How to work with them": up to six numbered doors, saved as one full-replace PUT.
import { View, Text, StyleSheet } from 'react-native'
import { ORG_DOOR_TARGETS, type OrgDoorTarget } from '@splat-connect/types'
import { theme } from '../../../lib/theme'
import { MAX_DOORS, type DoorDraft } from '../../../lib/org-lists'
import { Card } from '../../ui/Card'
import { Chip } from '../../ui/Chip'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/TextField'
import { ListSection } from '../../list/list-kit'

let next = 0
export const newDoorKey = () => `new-door-${next++}`

export function OrgDoors({ doors, onChange }: { doors: DoorDraft[]; onChange: (next: DoorDraft[]) => void }) {
  const set = (i: number, patch: Partial<DoorDraft>) => onChange(doors.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  return (
    <>
      <ListSection style={styles.group}>How to work with them</ListSection>
      <Text style={styles.lede}>The numbered cards halfway down your page, up to six. Say each one the way you would say it to a parent on the phone.</Text>
      {doors.map((d, i) => (
        <Card key={d.key} style={styles.card}>
          <TextField label={`Door ${i + 1} title`} value={d.title} maxLength={60} placeholder="Ask for a toy" onChangeText={(v) => set(i, { title: v })} />
          <TextField label={`Door ${i + 1} line`} value={d.body} maxLength={200} placeholder="One line a parent would understand on the phone." onChangeText={(v) => set(i, { body: v })} />
          <Text style={styles.small}>Where it takes them</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {ORG_DOOR_TARGETS.map((t) => (
              <Chip key={t.value} role="radio" label={t.label} active={d.target === t.value} onPress={() => set(i, { target: t.value as OrgDoorTarget })} />
            ))}
          </View>
          <Button label="Remove" accessibilityLabel={`Remove door ${i + 1}`} variant="danger" onPress={() => onChange(doors.filter((_, j) => j !== i))} />
        </Card>
      ))}
      {doors.length < MAX_DOORS ? (
        <Button
          label="Add a door"
          variant="secondary"
          onPress={() => onChange([...doors, { key: newDoorKey(), title: '', body: '', target: 'message' }])}
        />
      ) : (
        <Text style={styles.lede}>{MAX_DOORS} doors is the most a page shows.</Text>
      )}
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

// packages/mobile/components/organisation/sections/org-offers.tsx
// "What you do" capabilities, and the recycling you can take.
import { View, Text, StyleSheet } from 'react-native'
import { ORG_CAPABILITIES, PRINT_MATERIALS } from '@splat-connect/types'
import { theme } from '../../../lib/theme'
import { Chip } from '../../ui/Chip'
import { TextField } from '../../ui/TextField'
import { ListSection } from '../../list/list-kit'
import { toggle } from './toggle'

export function OrgOffers({
  capabilities,
  onCapabilities,
  materials,
  onMaterials,
  recyclingNote,
  onRecyclingNote,
}: {
  capabilities: string[]
  onCapabilities: (next: string[]) => void
  materials: string[]
  onMaterials: (next: string[]) => void
  recyclingNote: string
  onRecyclingNote: (v: string) => void
}) {
  return (
    <>
      <ListSection style={styles.group}>What you do</ListSection>
      <Text style={styles.lede}>Each one you switch on becomes a chip on your profile, and a door families can ask you through. Switch it off and the door closes. Nothing already in progress is affected.</Text>
      <View style={styles.chips}>
        {ORG_CAPABILITIES.map((c) => (
          <Chip key={c} label={c} active={capabilities.includes(c)} onPress={() => onCapabilities(toggle(capabilities, c))} />
        ))}
      </View>
      <ListSection style={styles.group}>Recycling you can take</ListSection>
      <Text style={styles.lede}>Leave this empty if you do not take drop-offs. The booking form only appears when there is something on this list.</Text>
      <View style={styles.chips}>
        {PRINT_MATERIALS.map((m) => (
          <Chip key={m} label={m} active={materials.includes(m)} onPress={() => onMaterials(toggle(materials, m))} />
        ))}
      </View>
      <TextField label="How you want it brought" value={recyclingNote} maxLength={500} multiline onChangeText={onRecyclingNote} />
    </>
  )
}

const styles = StyleSheet.create({
  group: { marginTop: theme.spacing(3), marginBottom: 0 },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})

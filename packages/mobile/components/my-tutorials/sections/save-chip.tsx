// packages/mobile/components/my-tutorials/sections/save-chip.tsx
// The only feedback that a write happened, now the Save buttons are gone.
import { Text, StyleSheet } from 'react-native'
import { theme } from '../../../lib/theme'
import type { DraftSaveState } from '../../../lib/use-tutorial-draft'

const LABEL: Record<DraftSaveState, string | null> = {
  idle: null,
  saving: 'Saving...',
  saved: 'Saved',
  // The error itself is shown by an ErrorRow in the section; a chip saying
  // "Error" as well would be the same news twice.
  error: null,
}

export function SaveChip({ state }: { state: DraftSaveState }) {
  const label = LABEL[state]
  if (!label) return null
  return <Text style={styles.chip}>{label}</Text>
}

const styles = StyleSheet.create({
  chip: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.mintDeep,
    alignSelf: 'flex-end',
    marginBottom: theme.spacing(2),
  },
})

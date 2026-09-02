// The only feedback that a write happened, now the Save buttons are gone.
//
// Lives in the stack header (see (my)/tutorials/[id]/_layout.tsx) rather than
// at the top of each section's body, where it moved the content down a line
// every time its state changed. It reads the draft itself, so the header can
// declare it once for all seven screens.
import { Text, StyleSheet } from 'react-native'
import { useDraft } from '../../../lib/use-tutorial-draft'
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

export function SaveChip() {
  const { saveState } = useDraft()
  const label = LABEL[saveState]
  if (!label) return null
  return (
    <Text testID="save-chip" style={styles.chip}>
      {label}
    </Text>
  )
}

const styles = StyleSheet.create({
  chip: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.mintDeep,
  },
})

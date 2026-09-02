// packages/mobile/components/my-tutorials/sections/picker-note.tsx
//
// What the Files picker can and cannot reach.
//
// The iOS document picker only sees on-device storage and iCloud Drive, so a
// PDF or an STL sitting on a laptop is genuinely unreachable from these
// buttons. That is most of the time for an STL, which comes out of CAD or off a
// model site and rarely touches a phone at all. Left unsaid, the button opens
// an empty picker and reads as broken; said, it is a redirect.
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../../lib/theme'

export function PickerNote({ noun }: { noun: 'PDF' | 'STL' }) {
  return (
    <View style={styles.note}>
      <Ionicons name="information-circle-outline" size={18} color={theme.colors.primaryDeep} />
      <Text style={styles.text}>
        Can&apos;t find your {noun} here? Files only shows what&apos;s saved on this phone or in
        iCloud Drive. Add it from the SPLAT website on a computer and it will appear on this guide.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.primaryDeep,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    marginTop: theme.spacing(3),
  },
  text: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
    lineHeight: 18,
  },
})

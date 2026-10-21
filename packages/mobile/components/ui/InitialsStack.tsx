// packages/mobile/components/ui/InitialsStack.tsx
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

const TINTS = [theme.colors.accentLight, theme.colors.apricotSoft, theme.colors.mintSoft, theme.colors.violetSoft, theme.colors.honeySoft]

/**
 * Overlapping initial discs, then a "+N" disc for the rest. Initials only,
 * never names: the event page says the room will be busy without saying which
 * families attend.
 */
export function InitialsStack({ initials, more = 0 }: { initials: string[]; more?: number }) {
  return (
    <View style={styles.row} accessible={false} importantForAccessibility="no-hide-descendants">
      {initials.map((i, n) => (
        <View key={`${i}-${n}`} style={[styles.disc, n > 0 && styles.overlap, { backgroundColor: TINTS[n % TINTS.length] }]}>
          <Text style={styles.text}>{i}</Text>
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.disc, initials.length > 0 && styles.overlap, styles.more]}>
          <Text style={styles.text}>+{more}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  disc: { width: 40, height: 40, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.background },
  overlap: { marginLeft: -10 },
  more: { backgroundColor: theme.colors.surfaceSunken },
  text: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
})

// packages/mobile/components/ui/ItemActions.tsx
//
// Save · Thanks · Report together: round icon buttons over the top right of a
// guide's or a toy's photo. Each one answers: Save and Thanks fill and raise
// a toast (Save with Undo), Report opens its sheet.
import { Pressable, View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { ReportSubjectKind, SaveSlug } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import type { Saves } from '../../lib/saves'
import { ReportProblem } from '../reports/report-problem'

type IconName = React.ComponentProps<typeof Ionicons>['name']

function ActionButton({ icon, a11y, on, busy, onPress }: { icon: IconName; a11y: string; on?: boolean; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: !!on, busy: !!busy }}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={on ? theme.colors.apricot : theme.colors.ink} />
    </Pressable>
  )
}

export function ItemActions({
  save,
  thanks,
  report,
  onToast,
}: {
  save: { slug: SaveSlug; id: string; saves: Saves }
  /** Left out where there is nobody to thank (your own guide or toy). */
  thanks?: { to: string; thanked: boolean; busy: boolean; send: () => Promise<boolean> }
  report: { kind: ReportSubjectKind; id: string; label: string }
  onToast: (text: string, undo?: () => void) => void
}) {
  const saved = save.saves.isSaved(save.slug, save.id)
  const toggleSave = () => {
    ;(saved ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)).catch(() => {})
    void save.saves.toggle(save.slug, save.id)
    onToast(saved ? 'Removed from My saves' : 'Saved to My saves', () => void save.saves.toggle(save.slug, save.id))
  }

  return (
    <View style={styles.row}>
      <ActionButton icon={saved ? 'heart' : 'heart-outline'} a11y={saved ? 'Saved. Tap to remove from My saves' : 'Save'} on={saved} onPress={toggleSave} />
      {thanks ? (
        <ActionButton
          icon={thanks.thanked ? 'thumbs-up' : 'thumbs-up-outline'}
          a11y={thanks.thanked ? `Thanked ${thanks.to}` : `Thank ${thanks.to}`}
          on={thanks.thanked}
          busy={thanks.busy}
          onPress={async () => {
            if (thanks.thanked) return onToast(`You already thanked ${thanks.to}`)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
            onToast((await thanks.send()) ? `Thanks sent to ${thanks.to}` : 'Could not send that. Try again.')
          }}
        />
      ) : null}
      <ReportProblem
        subjectKind={report.kind}
        subjectId={report.id}
        subjectLabel={report.label}
        trigger={(open) => <ActionButton icon="flag-outline" a11y="Report a problem" onPress={open} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.spacing(2) },
  // Frosted so they read over any photo, in either mode.
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass, ...theme.shadow(1) },
  pressed: { transform: [{ scale: 0.92 }] },
})

// packages/mobile/components/ui/ItemActions.tsx
//
// Save · Thanks · Report as one row of labelled buttons under a guide's or a
// toy's title (round 3, option B). Each one answers: Save and Thanks fill
// and raise a toast (Save with Undo), Report opens its sheet.
import { Pressable, Text, View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { ReportSubjectKind, SaveSlug } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import type { Saves } from '../../lib/saves'
import { ReportProblem } from '../reports/report-problem'

type IconName = React.ComponentProps<typeof Ionicons>['name']

function ActionButton({ icon, label, a11y, on, busy, onPress }: { icon: IconName; label: string; a11y: string; on?: boolean; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: !!on, busy: !!busy }}
      style={({ pressed }) => [styles.button, on && styles.on, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={on ? theme.colors.apricot : theme.colors.ink} />
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
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
      <ActionButton icon={saved ? 'heart' : 'heart-outline'} label={saved ? 'Saved' : 'Save'} a11y={saved ? 'Saved. Tap to remove from My saves' : 'Save'} on={saved} onPress={toggleSave} />
      {thanks ? (
        <ActionButton
          icon={thanks.thanked ? 'thumbs-up' : 'thumbs-up-outline'}
          label={thanks.thanked ? 'Thanked' : 'Thanks'}
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
        trigger={(open) => <ActionButton icon="flag-outline" label="Report" a11y="Report a problem" onPress={open} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.spacing(2) },
  button: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(2),
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  on: { backgroundColor: theme.colors.apricotSoft },
  pressed: { transform: [{ scale: 0.96 }] },
  label: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
})

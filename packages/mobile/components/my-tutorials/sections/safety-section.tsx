// packages/mobile/components/my-tutorials/sections/safety-section.tsx
//
// Its own screen rather than a block at the bottom of Details, because it is
// its own gate: a guide cannot be submitted without it, and a checklist buried
// under three chip rows was one nobody read.
import { Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SAFETY_CHECKLIST } from '@splat-connect/types'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { ErrorRow } from '../../auth-screen'
import { SaveChip } from './save-chip'

export function SafetySection() {
  const { tutorial, save, saveState, saveError } = useDraft()
  if (!tutorial) return null

  const declared = tutorial.safety_declared_at

  return (
    <Screen>
      <SaveChip state={saveState} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {SAFETY_CHECKLIST.map((item) => (
          <Text key={item} style={styles.item}>
            {'•'} {item}
          </Text>
        ))}

        {declared ? (
          // No way to unmake it: a declaration that can be toggled off is not a
          // declaration. Reversing one is a support conversation, not a tap.
          <Text style={styles.declared}>
            Declared on {new Date(declared).toLocaleDateString('en-AU')}.
          </Text>
        ) : (
          // Defaults to off on purpose — a declaration is made, never assumed.
          // The client only ever affirms; the server stamps the timestamp.
          <Pressable
            testID="safety-declare"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
            onPress={() => save({ safety_declared: true })}
            style={styles.tick}
          >
            <Ionicons name="square-outline" size={20} color={theme.colors.primaryDeep} />
            <Text style={styles.tickText}>
              I have checked this design against every point above. A guide cannot be
              submitted for review without this.
            </Text>
          </Pressable>
        )}

        <ErrorRow message={saveError} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  item: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 21,
    marginBottom: theme.spacing(2),
  },
  declared: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.label,
    color: theme.colors.mintDeep,
    marginTop: theme.spacing(4),
  },
  tick: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    marginTop: theme.spacing(4),
  },
  tickText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
  },
})

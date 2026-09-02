// packages/mobile/components/ui/StepPills.tsx
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

export type StepPillStatus = 'done' | 'attention' | 'neutral'

export interface StepPillItem {
  id: string
  label: string
  status: StepPillStatus
}

/**
 * The free-jump step navigator's pill row — one pill per section, each
 * carrying a status dot. Mirrors web's step-pill-row (components/stepper.tsx):
 * a done step is marked, an incomplete one gets a hazard dot, and a step with
 * nothing required yet stays bare. The tutorial editor is the first to use
 * this; the toy and child editors adopt the same row later rather than
 * keeping their own copies.
 *
 * The status glyph is hidden from the accessibility tree — same call as
 * web's `aria-hidden` on its dot — because a screen reader repeating "check
 * mark" or "dot" ahead of every step name would say less than the plain step
 * name does on its own.
 */
export function StepPills({
  steps,
  active,
  onSelect,
}: {
  steps: StepPillItem[]
  active: string
  onSelect: (id: string) => void
}) {
  return (
    <ScrollView
      testID="step-rail"
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {steps.map((step) => {
        const selected = step.id === active
        return (
          <Pressable
            key={step.id}
            onPress={() => onSelect(step.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.pill, selected && styles.pillActive]}
          >
            {step.status !== 'neutral' ? (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                // The two props above are native-only. This pill has no
                // accessibilityLabel of its own — unlike the library and
                // showcase cards, whose explicit label already overrides
                // their descendants — so on the web target the glyph leaked
                // into the computed name and the pill answered to "✓ Details".
                aria-hidden
                testID={`step-pill-${step.status === 'done' ? 'check' : 'dot'}-${step.id}`}
              >
                {step.status === 'done' ? (
                  <Text style={styles.check}>✓</Text>
                ) : (
                  <View style={styles.dot} />
                )}
              </View>
            ) : null}
            <Text style={[styles.label, selected && styles.labelActive]}>{step.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  // The rail is a fixed-height strip, never a region that absorbs leftover
  // space. Without this it does, and the pills stretch with it: on the toy
  // editor -- StepPills as a direct flex child of a flex:1 Screen, beside a
  // flex:1 ScrollView -- they rendered 245px tall instead of 40, eating the
  // screen and pushing that step's own controls off it. Measured 2026-09-02 on
  // react-native-web; the child editor, where the row sits in ordinary content
  // flow with no leftover height to claim, was 40px from the same code.
  //
  // alignItems guards the other half of it: a stretched content container
  // would size the pills even if the scroller itself were pinned.
  scroller: { flexGrow: 0, flexShrink: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing(3),
    backgroundColor: theme.colors.surface,
  },
  pillActive: { backgroundColor: theme.colors.ink },
  check: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.mint },
  // 7px, per spec — a hazard dot, not a badge.
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.apricot },
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  labelActive: { color: theme.colors.background },
})

// packages/mobile/components/profile/customization-screen.tsx
import { View, Text, Switch, StyleSheet } from 'react-native'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { ChipGroup, Dropdown, FormScreen, NumberField } from './fields'
import { Section } from '../ui/Section'

const HAND_DOMINANCE = ['Left', 'Right', 'Ambidextrous', 'Not yet established'].map((d) => ({ label: d, value: d }))
const SENSORY = ['Soft', 'Firm', 'Smooth', 'Textured', 'Lightweight', 'No preference'].map((s) => ({ label: s, value: s }))

export function CustomizationScreen({ childId }: { childId?: string } = {}) {
  const { profile, save } = useChildProfile(childId)

  return (
    <FormScreen intro="These measurements size the 3D-printed parts. Millimetres, measured on the hand your child leads with.">

      <Section title="Measurements">
        <NumberField
          label="Palm width"
          unit="mm"
          guidance="Measure across the knuckles of the dominant hand."
          value={profile?.palm_width_mm ?? null}
          onChange={(v) => save({ palm_width_mm: v })}
        />
        <NumberField
          label="Wrist circumference"
          unit="mm"
          guidance="Wrap a tape around the wrist just below the hand."
          value={profile?.wrist_circ_mm ?? null}
          onChange={(v) => save({ wrist_circ_mm: v })}
        />

        {/*
          The platform Switch is kept rather than restyled into a custom
          control: it already carries the right role and state for assistive
          tech, and reinventing it would only change how it looks.
        */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Needs arm attachment?</Text>
          <Switch
            testID="arm-attachment-switch"
            value={profile?.needs_arm_attachment ?? false}
            onValueChange={(b) => save({ needs_arm_attachment: b })}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        {profile?.needs_arm_attachment ? (
          <NumberField
            label="Forearm length"
            unit="mm"
            guidance="Measure from the elbow crease to the wrist."
            value={profile?.forearm_length_mm ?? null}
            onChange={(v) => save({ forearm_length_mm: v })}
          />
        ) : null}
      </Section>

      <Section title="Preferences" hint="Used to pick materials and grip shapes that suit your child.">
        <Dropdown
          label="Hand dominance"
          value={profile?.hand_dominance ?? null}
          options={HAND_DOMINANCE}
          onChange={(v) => save({ hand_dominance: v })}
        />
        <ChipGroup
          label="Sensory preferences"
          values={profile?.sensory_preferences ?? []}
          options={SENSORY}
          onChange={(v) => save({ sensory_preferences: v })}
        />
      </Section>
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(4),
    marginBottom: theme.spacing(4),
  },
  toggleLabel: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
  },
})

// packages/mobile/components/profile/everyday-needs-screen.tsx
import { ScrollView, Text, StyleSheet } from 'react-native'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { ChipGroup, Dropdown } from './fields'
import { TextField } from '../ui/TextField'
import { Section } from '../ui/Section'

const CHALLENGES = ['Grasping', 'Holding', 'Fine motor', 'Strength', 'Coordination', 'Fatigue', 'Other'].map((c) => ({ label: c, value: c }))
const GRIP_TYPES = ['Palmar', 'Pincer', 'Cylindrical', 'Hook', 'Spherical'].map((g) => ({ label: g, value: g }))
const ENVIRONMENTS = ['Home', 'School', 'Therapy', 'Outdoors', 'Mixed'].map((e) => ({ label: e, value: e }))

export function EverydayNeedsScreen() {
  const { profile, save } = useChildProfile()
  const challenges = profile?.challenges ?? []

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        What&apos;s hardest day to day? This steers which tutorials get suggested first.
      </Text>

      <Section title="Top challenges" hint="Pick up to three, so the suggestions stay focused.">
        <ChipGroup
          label="Top challenges"
          values={challenges}
          options={CHALLENGES}
          max={3}
          onChange={(v) => save({ challenges: v })}
        />
        {challenges.includes('Other') ? (
          <TextField
            label="Other challenge"
            placeholder="Describe the other challenge"
            defaultValue={profile?.challenge_other ?? ''}
            onChangeText={(v) => save({ challenge_other: v })}
          />
        ) : null}
      </Section>

      <Section title="Grip and setting">
        <Dropdown
          label="Grip type"
          value={profile?.grip_type ?? null}
          options={GRIP_TYPES}
          onChange={(v) => save({ grip_type: v })}
        />
        <Dropdown
          label="Usage environment"
          value={profile?.env_context ?? null}
          options={ENVIRONMENTS}
          onChange={(v) => save({ env_context: v })}
        />
      </Section>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4), paddingBottom: theme.spacing(10) },
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
    marginBottom: theme.spacing(5),
  },
})

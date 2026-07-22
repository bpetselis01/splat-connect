// packages/mobile/components/profile/everyday-needs-screen.tsx
import { ScrollView, View, Text, TextInput, StyleSheet } from 'react-native'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { ChipGroup, Dropdown } from './fields'

const CHALLENGES = ['Grasping', 'Holding', 'Fine motor', 'Strength', 'Coordination', 'Fatigue', 'Other'].map((c) => ({ label: c, value: c }))
const GRIP_TYPES = ['Palmar', 'Pincer', 'Cylindrical', 'Hook', 'Spherical'].map((g) => ({ label: g, value: g }))
const ENVIRONMENTS = ['Home', 'School', 'Therapy', 'Outdoors', 'Mixed'].map((e) => ({ label: e, value: e }))

export function EverydayNeedsScreen() {
  const { profile, save } = useChildProfile()
  const challenges = profile?.challenges ?? []

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ChipGroup
        label="Top challenges"
        values={challenges}
        options={CHALLENGES}
        max={3}
        onChange={(v) => save({ challenges: v })}
      />
      {challenges.includes('Other') ? (
        <View style={styles.field}>
          <Text style={styles.label}>Other challenge</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe the other challenge"
            defaultValue={profile?.challenge_other ?? ''}
            onChangeText={(v) => save({ challenge_other: v })}
          />
        </View>
      ) : null}
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4) },
  field: { marginBottom: theme.spacing(4) },
  label: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, marginBottom: theme.spacing(2) },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing(3),
    fontFamily: theme.fonts.regular,
  },
})

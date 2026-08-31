// packages/mobile/components/profile/everyday-needs-screen.tsx
import { useChildProfile } from '../../lib/use-child-profile'
import { ChipGroup, Dropdown, FormScreen } from './fields'
import { TextField } from '../ui/TextField'
import { Section } from '../ui/Section'

const CHALLENGES = ['Grasping', 'Holding', 'Fine motor', 'Strength', 'Coordination', 'Fatigue', 'Other'].map((c) => ({ label: c, value: c }))
const GRIP_TYPES = ['Palmar', 'Pincer', 'Cylindrical', 'Hook', 'Spherical'].map((g) => ({ label: g, value: g }))
const ENVIRONMENTS = ['Home', 'School', 'Therapy', 'Outdoors', 'Mixed'].map((e) => ({ label: e, value: e }))

export function EverydayNeedsScreen() {
  const { profile, save } = useChildProfile()
  const challenges = profile?.challenges ?? []

  return (
    <FormScreen intro="What's hardest day to day? This steers which tutorials get suggested first.">

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
    </FormScreen>
  )
}


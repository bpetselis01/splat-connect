// packages/mobile/components/profile/child-editor-home.tsx
// One child's profile as one page, the same questions web's
// components/child-editor.tsx asks: Basics (name, age), the four switch
// questions, and the everyday needs of the room. Every answer autosaves through
// useChildProfile, the mobile pattern, with a "Saved" line to confirm it.
//
// The older ability / everyday-needs / customisation sheets (MACS, BFMF, grip,
// measurements…) are gone: those columns stay in the database but nothing asks
// for them now (APP 3 minimisation). These are plain-language preferences for
// ranking guides, never a clinical assessment — see docs/REGULATORY-CHANGES.md.
import { ScrollView, View, Text, Linking, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { CHILD_QUESTIONS } from '@splat-connect/types'
import { NotMedicalNote } from '../ui/NotMedicalNote'
import { apiClient } from '../../lib/api-client'
import { confirmDestructive, notify } from '../../lib/confirm'
import { theme } from '../../lib/theme'
import { useChildProfile } from '../../lib/use-child-profile'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Section } from '../ui/Section'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ChoiceChips, NeedsChips } from './fields'

export function ChildEditorHome({ childId }: { childId: string }) {
  const router = useRouter()
  const { profile, loading, save, saveState } = useChildProfile(childId)

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width="60%" height={20} />
        <Skeleton width="100%" height={90} />
      </View>
    )
  }
  if (!profile) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="help-circle-outline"
          title="Couldn't find this profile."
          hint="It may have been deleted on another device."
        />
      </View>
    )
  }

  function confirmDelete() {
    confirmDestructive('Delete this profile?', 'Everything on it is removed. This cannot be undone.', 'Delete', () => {
      apiClient
        .delete(`/api/child-profiles/${childId}`)
        .then(() => router.back())
        .catch((err) => {
          console.error('[ChildEditorHome] delete failed:', err)
          notify('Could not delete this profile', 'Please try again.')
        })
    })
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PRIVATE TO YOU</Text>
      <Text style={styles.intro}>
        Every field is optional. We use this only to suggest guides that suit your child — it is
        never shown to another person, contributor or organisation. See the{' '}
        <Text style={styles.link} onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_WEB_URL}/privacy`)}>
          privacy policy
        </Text>
        .
      </Text>

      <Section title="Basics">
        <TextField
          label="Name or nickname"
          accessibilityLabel="Child's name"
          placeholder="Optional"
          defaultValue={profile.name ?? ''}
          onChangeText={(v) => save({ name: v.trim() || null })}
        />
        <TextField
          label="Age"
          accessibilityLabel="Child's age"
          placeholder="Optional"
          keyboardType="numeric"
          defaultValue={profile.age != null ? String(profile.age) : ''}
          onChangeText={(v) => {
            if (v.trim() === '') save({ age: null })
            else if (!Number.isNaN(Number(v))) save({ age: Number(v) })
          }}
        />
      </Section>

      <Section
        title="Ability profile"
        hint="Used to rank guides by whether the switch they call for is one your child can operate."
      >
        {CHILD_QUESTIONS.map((q) => (
          <ChoiceChips
            key={q.field}
            label={q.prompt}
            options={q.options}
            value={profile[q.field]}
            onChange={(v) => save({ [q.field]: v })}
          />
        ))}
      </Section>

      <Section title="Everyday needs" hint="What matters in the room, rather than in the hand.">
        <NeedsChips value={profile.everyday_needs ?? []} onChange={(v) => save({ everyday_needs: v })} />
      </Section>

      {saveState === 'saved' ? <Text style={styles.saved}>Saved</Text> : null}
      <NotMedicalNote />

      <Button label="Delete profile" variant="danger" onPress={confirmDelete} style={styles.delete} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4), paddingBottom: theme.spacing(10) },
  loading: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), gap: theme.spacing(3) },
  eyebrow: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    letterSpacing: 1.2,
    color: theme.colors.muted,
    marginBottom: theme.spacing(2),
  },
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
    marginBottom: theme.spacing(5),
  },
  link: { textDecorationLine: 'underline' },
  saved: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  delete: { marginTop: theme.spacing(6), alignSelf: 'center' },
})

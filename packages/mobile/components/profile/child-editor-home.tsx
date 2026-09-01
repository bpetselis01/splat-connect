// packages/mobile/components/profile/child-editor-home.tsx
// One child's editor home: name and age, the step-pill row over the three
// step screens, and Delete profile. The spec's shape — "rows → child editor
// with the existing three steps, wrapped in the step-pill row; gap dot on an
// unset step; Delete profile".
//
// A step is 'done' when its anchor fields hold values, 'attention' otherwise —
// the same reading web's stepper gives a tutorial's sections. Nothing here is
// required, so 'attention' is a gap dot, not an error.
import { View, Text, Alert, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import type { ChildProfile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useChildProfile } from '../../lib/use-child-profile'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { StepPills, type StepPillItem } from '../ui/StepPills'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { Ionicons } from '@expo/vector-icons'

const STEPS: {
  id: string
  label: string
  path: string
  hint: string
  icon: keyof typeof Ionicons.glyphMap
  /** The fields whose presence marks the step done. */
  done: (p: ChildProfile) => boolean
}[] = [
  {
    id: 'ability',
    label: 'Ability',
    path: '/account/ability',
    hint: 'Diagnosis, hand involvement, MACS and BFMF',
    icon: 'accessibility-outline',
    done: (p) => !!(p.primary_diagnosis || p.macs_level || p.bfmf_score),
  },
  {
    id: 'everyday-needs',
    label: 'Everyday needs',
    path: '/account/everyday-needs',
    hint: 'Challenges, grip type and where it gets used',
    icon: 'today-outline',
    done: (p) => p.challenges.length > 0 || !!p.grip_type || !!p.env_context,
  },
  {
    id: 'customization',
    label: 'Customisation',
    path: '/account/customization',
    hint: 'Measurements that size the 3D-printed parts',
    icon: 'resize-outline',
    done: (p) => p.palm_width_mm !== null || p.wrist_circ_mm !== null || !!p.hand_dominance,
  },
]

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

  const pills: StepPillItem[] = STEPS.map((s) => ({
    id: s.id,
    label: s.label,
    status: s.done(profile) ? 'done' : 'attention',
  }))

  function confirmDelete() {
    Alert.alert('Delete this profile?', 'Everything on it is removed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          apiClient
            .delete(`/api/child-profiles/${childId}`)
            .then(() => router.back())
            .catch((err) => {
              console.error('[ChildEditorHome] delete failed:', err)
              Alert.alert('Could not delete this profile', 'Please try again.')
            })
        },
      },
    ])
  }

  const openStep = (path: string) => router.push({ pathname: path, params: { child: childId } })

  return (
    <View style={styles.screen}>
      <TextField
        label="Name"
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
          if (v.trim() !== '' && !Number.isNaN(Number(v))) save({ age: Number(v) })
        }}
      />
      {saveState === 'saved' ? <Text style={styles.saved}>Saved</Text> : null}

      <StepPills
        steps={pills}
        active=""
        onSelect={(id) => {
          const step = STEPS.find((s) => s.id === id)
          if (step) openStep(step.path)
        }}
      />

      {STEPS.map((step) => (
        <AnimatedPressable
          key={step.id}
          onPress={() => openStep(step.path)}
          accessibilityRole="button"
          accessibilityLabel={step.label}
          accessibilityHint={step.hint}
          pressScale={0.985}
          style={styles.rowPress}
        >
          <Card style={styles.row}>
            <Ionicons name={step.icon} size={20} color={theme.colors.primaryDeep} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{step.label}</Text>
              <Text style={styles.rowHint}>{step.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
          </Card>
        </AnimatedPressable>
      ))}

      <Button label="Delete profile" variant="danger" onPress={confirmDelete} style={styles.delete} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  loading: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), gap: theme.spacing(3) },
  saved: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginBottom: theme.spacing(2),
  },
  rowPress: { marginTop: theme.spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  rowBody: { flex: 1 },
  rowLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  rowHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: 2,
  },
  delete: { marginTop: theme.spacing(6), alignSelf: 'center' },
})

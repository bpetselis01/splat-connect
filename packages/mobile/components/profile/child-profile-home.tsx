// Embedded as the "Child Profile" segment of the merged Profile tab
// (components/profile-screen.tsx) — it owns none of the screen chrome
// (header, account identity, sign out) since that segment shares a screen
// with the "Account" segment, which already provides all of it.
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { Card } from '../ui/Card'
import { TextField } from '../ui/TextField'
import { AnimatedPressable } from '../ui/AnimatedPressable'

const SUB_SCREENS: {
  label: string
  path: string
  icon: keyof typeof Ionicons.glyphMap
  hint: string
}[] = [
  {
    label: 'Ability Profile',
    path: '/profile/ability',
    icon: 'accessibility-outline',
    hint: 'Diagnosis, hand involvement, MACS and BFMF',
  },
  {
    label: 'Everyday Needs',
    path: '/profile/everyday-needs',
    icon: 'today-outline',
    hint: 'Challenges, grip type and where it gets used',
  },
  {
    label: 'Customization Metrics',
    path: '/profile/customization',
    icon: 'resize-outline',
    hint: 'Measurements that size the 3D-printed parts',
  },
]

export function ChildProfileHome() {
  const router = useRouter()
  const { profile, loading, save, saveState } = useChildProfile()

  function onChangeAge(v: string) {
    if (v.trim() !== '' && !Number.isNaN(Number(v))) save({ age: Number(v) })
  }

  return (
    <View>
        <TextField
          label="Child's age"
          placeholder="Age"
          keyboardType="numeric"
          defaultValue={profile?.age != null ? String(profile.age) : ''}
          onChangeText={onChangeAge}
        />

        {/* Confirms the debounced autosave. Polite live region so a screen reader
            announces "Saved" without stealing focus from the field. */}
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.saveStatus, saveState === 'saved' && styles.saveStatusDone]}
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ' '}
        </Text>

        {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}

        <Text style={styles.sectionTitle}>Child profile</Text>
        {SUB_SCREENS.map((s) => (
          <AnimatedPressable
            key={s.path}
            onPress={() => router.push(s.path)}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            accessibilityHint={s.hint}
            pressScale={0.985}
            style={styles.tilePress}
          >
            <Card style={styles.tile}>
              <View style={styles.tileIcon}>
                <Ionicons name={s.icon} size={22} color={theme.colors.primary} />
              </View>
              <View style={styles.tileBody}>
                <Text style={styles.tileLabel}>{s.label}</Text>
                <Text style={styles.tileHint} numberOfLines={2}>{s.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
            </Card>
          </AnimatedPressable>
        ))}

    </View>
  )
}

const styles = StyleSheet.create({
  saveStatus: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'right',
    // Pull up under the field and reserve a line so toggling doesn't shift layout.
    marginTop: -theme.spacing(2),
    marginBottom: theme.spacing(3),
    minHeight: 16,
  },
  saveStatusDone: { color: theme.colors.mintDeep },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing(3),
  },
  tilePress: { marginBottom: theme.spacing(3) },
  tile: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(4) },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: { flex: 1 },
  tileLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.text },
  tileHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: theme.spacing(1),
  },
})

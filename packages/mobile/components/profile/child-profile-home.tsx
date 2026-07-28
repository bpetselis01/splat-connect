// packages/mobile/components/profile/child-profile-home.tsx
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth-context'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { Card } from '../ui/Card'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { ScreenHeader } from '../ui/ScreenHeader'

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

function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function ChildProfileHome() {
  const router = useRouter()
  const { profile: account, signOut } = useAuth()
  const { profile, loading, save, saveState } = useChildProfile()

  function onChangeAge(v: string) {
    if (v.trim() !== '' && !Number.isNaN(Number(v))) save({ age: Number(v) })
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScreenHeader title="Profile" showLogo />

        <Card style={styles.account}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(account?.name)}</Text>
          </View>
          <View style={styles.accountBody}>
            <Text style={styles.name} numberOfLines={1}>{account?.name}</Text>
            <Text style={styles.email} numberOfLines={1}>{account?.email}</Text>
          </View>
        </Card>

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

        <Button label="Sign Out" onPress={() => signOut()} variant="ghost" style={styles.signOut} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(8) },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(4),
    marginBottom: theme.spacing(5),
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.primaryDeep,
  },
  accountBody: { flex: 1 },
  name: { fontFamily: theme.fonts.bold, fontSize: theme.type.heading, color: theme.colors.text },
  email: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
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
  signOut: { marginTop: theme.spacing(4) },
})

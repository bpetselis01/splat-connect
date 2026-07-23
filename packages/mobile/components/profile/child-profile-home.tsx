// packages/mobile/components/profile/child-profile-home.tsx
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth-context'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { Card } from '../ui/Card'

const SUB_SCREENS: { label: string; path: string }[] = [
  { label: 'Ability Profile', path: '/profile/ability' },
  { label: 'Everyday Needs', path: '/profile/everyday-needs' },
  { label: 'Customization Metrics', path: '/profile/customization' },
]

export function ChildProfileHome() {
  const router = useRouter()
  const { profile: account, signOut } = useAuth()
  const { profile, loading, save } = useChildProfile()

  function onChangeAge(v: string) {
    if (v.trim() !== '' && !Number.isNaN(Number(v))) save({ age: Number(v) })
  }

  return (
    <View style={styles.container}>
      <View style={styles.account}>
        <Text style={styles.name}>{account?.name}</Text>
        <Text style={styles.email}>{account?.email}</Text>
      </View>

      <Text style={styles.label}>Child's age</Text>
      <TextInput
        style={styles.input}
        placeholder="Age"
        keyboardType="numeric"
        defaultValue={profile?.age != null ? String(profile.age) : ''}
        onChangeText={onChangeAge}
      />

      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}

      {SUB_SCREENS.map((s) => (
        <Pressable key={s.path} onPress={() => router.push(s.path)}>
          <Card style={styles.row}>
            <Text style={styles.rowLabel}>{s.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
          </Card>
        </Pressable>
      ))}

      <Pressable style={styles.signOut} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  account: { marginBottom: theme.spacing(4) },
  name: { fontFamily: theme.fonts.bold, fontSize: 20, color: theme.colors.text },
  email: { fontFamily: theme.fonts.regular, color: theme.colors.muted, marginTop: theme.spacing(1) },
  label: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, marginBottom: theme.spacing(1) },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(4),
    fontFamily: theme.fonts.regular,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  rowLabel: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, fontSize: 16 },
  signOut: { marginTop: theme.spacing(4), padding: theme.spacing(3), alignItems: 'center' },
  signOutText: { color: theme.colors.primary, fontFamily: theme.fonts.semiBold },
})

// The first screen a signed-out phone shows: the board's Create account
// welcome as one column, with the two doors people expect from every app.
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { Button } from '../../components/ui/Button'
import { Mascot } from '../../components/ui/TabHero'
import { AuthStage, Heading, Lede, pill } from '../../components/auth/parts'

const PROMISES = [
  'Child profiles stay private to you',
  "Every guide is reviewed before it's published",
  'Free, always. We never sell data',
]

export default function WelcomeScreen() {
  const router = useRouter()
  return (
    <AuthStage back={false}>
      <View style={styles.bear}>
        <Mascot pose="wave" size={120} />
      </View>
      <Heading center>Welcome to SPLAT Connect</Heading>
      <Lede center>Free, reviewed guides for switch-adapted play, and a community that builds them.</Lede>
      <View style={styles.promises}>
        {PROMISES.map((p) => (
          <View key={p} style={styles.promise}>
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.successDeep} />
            <Text style={styles.promiseText}>{p}</Text>
          </View>
        ))}
      </View>
      <Button testID="welcome-get-started" label="Get started" style={pill} onPress={() => router.push('/create-account')} />
      <Button
        testID="welcome-sign-in"
        label="I already have an account"
        variant="secondary"
        style={pill}
        onPress={() => router.push('/sign-in')}
      />
    </AuthStage>
  )
}

const styles = StyleSheet.create({
  bear: { alignItems: 'center' },
  promises: { gap: theme.spacing(2.5), alignSelf: 'center', marginVertical: theme.spacing(3) },
  promise: { flexDirection: 'row', gap: theme.spacing(2.5), alignItems: 'center' },
  promiseText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
})

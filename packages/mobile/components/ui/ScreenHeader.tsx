// packages/mobile/components/ui/ScreenHeader.tsx
import { View, Text, Image, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

export function ScreenHeader({ title, showLogo }: { title: string; showLogo?: boolean }) {
  return (
    <View style={styles.row}>
      {showLogo ? (
        <Image source={require('../../assets/splat-logo.png')} style={styles.logo} resizeMode="contain" />
      ) : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  logo: { width: 28, height: 28 },
  title: { fontFamily: theme.fonts.bold, fontSize: 22, color: theme.colors.text },
})

// packages/mobile/components/ui/ScreenHeader.tsx
import { View, Text, Image, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

export function ScreenHeader({
  title,
  subtitle,
  showLogo,
}: {
  title: string
  subtitle?: string
  showLogo?: boolean
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {showLogo ? (
          <Image
            source={require('../../assets/splat-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing(5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  logo: { width: 34, height: 34 },
  title: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.title,
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
})

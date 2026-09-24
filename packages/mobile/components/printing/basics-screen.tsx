// packages/mobile/components/printing/basics-screen.tsx
/**
 * Printing basics — enough to ask for a print with confidence. Static copy,
 * the board's four sections word for word except Bed size: the board says the
 * list only shows printers whose bed fits, and no guide stores its parts'
 * dimensions, so that promise is not one this app can keep.
 */
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'

const SECTIONS = [
  {
    t: 'What you are actually asking for',
    b: 'A file from the guide (an STL) turned into a plastic part. The printer’s job is to load the right material and press go. Yours is to pick who prints it and collect it.',
  },
  {
    t: 'PETG, PLA and why it matters',
    b: 'PLA is the everyday plastic: cheap, stiff, brittle. PETG bends before it snaps and shrugs off being chewed, clamped and dropped. Guides say which; anything a child pulls on is PETG.',
  },
  {
    t: 'Layer height and infill',
    b: '0.2 mm layers are the standard middle ground. Infill is how solid the inside is — 25 % is plenty for a mount. These come from the guide, so you never set them.',
  },
  {
    t: 'Bed size',
    b: 'The biggest part has to fit the printer’s bed. Every printer lists its bed, and the printer checks the parts fit before they accept.',
  },
]

export function PrintingBasicsScreen() {
  const router = useRouter()
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>3D Printing</Text>
        <Text style={styles.title}>Printing basics</Text>
        <Text style={styles.lede}>
          Enough to ask for a print with confidence. You do not need a printer, or to understand one.
        </Text>
        {SECTIONS.map((s) => (
          <View key={s.t} style={styles.section}>
            <Text accessibilityRole="header" style={styles.heading}>
              {s.t}
            </Text>
            <Text style={styles.body}>{s.b}</Text>
          </View>
        ))}
        <View style={styles.callout}>
          <Text style={styles.body}>
            <Text style={styles.strong}>The thing people get wrong: </Text>
            asking for PLA because it is cheaper. Anything a child pulls on or that clamps to a rail should be PETG.
            The guide already says which — leave it.
          </Text>
        </View>
        <Button label="Find a printer" onPress={() => router.push('/printing')} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(8), gap: theme.spacing(3) },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    // The board's coral fails contrast at 12px on the canvas; muted is the
    // eyebrow colour everywhere else in the app.
    color: theme.colors.muted,
  },
  title: { fontFamily: theme.fonts.display, fontSize: 28, color: theme.colors.text },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.muted, lineHeight: 23 },
  section: { gap: theme.spacing(2), marginTop: theme.spacing(2) },
  heading: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.text },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.ink, lineHeight: 24 },
  strong: { fontFamily: theme.fonts.black },
  callout: {
    padding: theme.spacing(4),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.apricotSoft,
    marginVertical: theme.spacing(2),
  },
})

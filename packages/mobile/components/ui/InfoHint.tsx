// packages/mobile/components/ui/InfoHint.tsx
//
// An info icon beside a label that opens the explanation in a centred card.
// Replaces the grey paragraphs under fields. The Modal is rendered here, inside
// the screen's own tree: an iOS formSheet cannot be presented over from the root.
import { useState, type ReactNode } from 'react'
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { Button } from './Button'

export function InfoHint({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`About ${title}`} onPress={() => setOpen(true)} hitSlop={12}>
        <Ionicons name="information-circle-outline" size={20} color={theme.colors.primaryDeep} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop} accessibilityViewIsModal onAccessibilityEscape={() => setOpen(false)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close" accessibilityRole="button" />
          <Pressable accessible={false} testID="info-hint-card" style={styles.card} onPress={() => {}}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.body}>{children}</Text>
            <Button label="Got it" onPress={() => setOpen(false)} />
          </Pressable>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: theme.colors.scrim, justifyContent: 'center', padding: theme.spacing(5) },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, padding: theme.spacing(4), gap: theme.spacing(3), ...theme.shadow(3) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 20 },
})

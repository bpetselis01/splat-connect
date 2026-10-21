// packages/mobile/components/people/thank-button.tsx
/**
 * One-tap thanks, as the board draws it (MB sayThanks): a person through 117,
 * an organisation through 077. A thanks for an exchange, print or build names
 * the transaction so the person's notification opens it. Thanking a person
 * opens a small sheet first with an optional note, which only they see (117).
 * The result is a flash line beside the button — the app has no toast host.
 */
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { apiClient } from '../../lib/api-client'
import { useAuth } from '../../lib/auth-context'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { FlashLine, useFlash } from '../ui/Flash'

export type ThankTarget = { profileId: string } | { orgId: string }

export function ThankButton({
  label,
  to,
  transactionId,
  variant = 'secondary',
  style,
}: {
  label: string
  to: ThankTarget
  transactionId?: string
  variant?: 'secondary' | 'ghost'
  style?: StyleProp<ViewStyle>
}) {
  const router = useRouter()
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [message, flash] = useFlash()
  // Nobody thanks themselves (117 refuses it); on your own showcase there is no button.
  if ('profileId' in to && session?.user.id === to.profileId) return null

  function start() {
    if (!session) return router.push('/sign-in')
    if ('profileId' in to) setOpen(true)
    else void thank()
  }

  async function thank() {
    setOpen(false)
    setBusy(true)
    try {
      if ('orgId' in to) await apiClient.post(`/api/organizations/${to.orgId}/thanks`, {})
      else {
        const text = note.trim()
        await apiClient.post(`/api/contributors/${to.profileId}/thanks`, {
          ...(text ? { note: text } : {}),
          ...(transactionId ? { transaction_id: transactionId } : {}),
        })
      }
      setSent(true)
      flash('Thanks sent — they will see it in their notifications')
    } catch (err) {
      if (err instanceof Error && /status 409/.test(err.message)) {
        setSent(true)
        flash('You already thanked them')
      } else flash('Could not send that. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={style}>
      <Button label={label} variant={variant} loading={busy} disabled={sent || busy} onPress={start} />
      <FlashLine message={message} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop} accessibilityViewIsModal onAccessibilityEscape={() => setOpen(false)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close" accessibilityRole="button" />
          <View style={styles.card}>
            <Text style={styles.title} accessibilityRole="header">Add a note?</Text>
            <TextField
              accessibilityLabel="Thank-you note"
              placeholder="Optional. A line about what it meant."
              value={note}
              onChangeText={setNote}
              maxLength={200}
              multiline
            />
            <Text style={styles.hint}>Only they will see this.</Text>
            <Button label="Send thanks" onPress={() => void thank()} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: theme.colors.scrim, justifyContent: 'center', padding: theme.spacing(5) },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, padding: theme.spacing(4), gap: theme.spacing(3), ...theme.shadow(3) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
})

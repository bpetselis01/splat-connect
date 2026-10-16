// packages/mobile/components/challenges/report-participant.tsx
// "Report" on a person in a challenge, and the sheet that asks why. Files
// POST /api/ideas/:id/reports; the reported person drops out of the reporter's
// view at once and an admin decides later. The copy is web's challenge-thread.tsx.
import { useState } from 'react'
import { Modal, View, Text, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiMessage } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Button } from '../ui/Button'
import { ErrorRow } from '../ui/ErrorRow'
import { TextField } from '../ui/TextField'

export const REPORT_CONFIRM = "You won't see them here any more. SPLAT will look at it, and they won't see your name."

export function ReportParticipant({
  ideaId,
  profileId,
  name,
  onReported,
}: {
  ideaId: string
  profileId: string
  name: string
  onReported: () => void
}) {
  const bottom = useBottomClearance()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const close = () => setOpen(false)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/ideas/${ideaId}/reports`, { reported_profile_id: profileId, reason: reason.trim() })
      close()
      onReported()
    } catch (err) {
      setError(apiMessage(err, 'Could not send that. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        label="Report"
        variant="danger"
        style={styles.trigger}
        accessibilityLabel={`Report ${name}`}
        onPress={() => {
          setReason('')
          setError(null)
          setOpen(true)
        }}
      />
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { paddingBottom: bottom }]}>
            <View style={styles.head}>
              <Text style={styles.title} accessibilityRole="header">{`Report ${name}`}</Text>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6} style={styles.close}>
                <Ionicons name="close" size={20} color={theme.colors.ink} />
              </Pressable>
            </View>
            <Text style={styles.sub}>{REPORT_CONFIRM}</Text>
            <TextField
              label="Why are you reporting them?"
              accessibilityLabel="Why are you reporting them?"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={2000}
            />
            <ErrorRow message={error} />
            <Button label="Send report" loading={busy} disabled={!reason.trim()} onPress={() => void submit()} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: { alignSelf: 'flex-start' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.scrim },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.card,
    borderTopRightRadius: theme.radii.card,
    padding: theme.spacing(5),
    gap: theme.spacing(4),
    ...theme.shadow(4),
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  title: { flex: 1, fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSunken },
  sub: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
})

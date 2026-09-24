// packages/mobile/components/reports/report-problem.tsx
/**
 * The board's quiet "Report a problem" link, and the sheet it opens. Files a
 * member report (POST /api/reports, 065) — web's components/report-link.tsx
 * with the same six reasons and the same two confirmation lines. The person
 * reported is never told who filed it; that is the API's rule, not this file's.
 */
import { useState } from 'react'
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'

const REASONS = [
  { value: 'arrived_broken', label: 'Arrived broken' },
  { value: 'no_show', label: 'Didn’t show up' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'wrong_info', label: 'Wrong or missing info' },
  { value: 'conduct', label: 'Behaviour' },
  { value: 'other', label: 'Something else' },
] as const

export function ReportProblem({
  subjectKind,
  subjectId,
  subjectLabel,
}: {
  subjectKind: 'guide' | 'toy'
  subjectId: string | null
  subjectLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  function start() {
    setReason(null)
    setText('')
    setError(null)
    setSent(null)
    setOpen(true)
  }

  async function submit() {
    if (!reason || !text.trim()) return
    setBusy(true)
    setError(null)
    try {
      await apiClient.post('/api/reports', {
        subject_kind: subjectKind,
        subject_id: subjectId,
        subject_label: subjectLabel,
        category: reason,
        body: text,
        ok_to_contact: true,
      })
      setSent(
        reason === 'safety'
          ? 'Sent. Safety reports go to the top of the queue — expect a reply today.'
          : 'Sent to SPLAT. You will hear back within two days.'
      )
    } catch {
      setError('Could not send that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Pressable onPress={start} accessibilityRole="button" hitSlop={8} style={styles.link}>
        <Ionicons name="flag-outline" size={14} color={theme.colors.muted} />
        <Text style={styles.linkText}>Report a problem</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Tell SPLAT what happened</Text>
              <Text style={styles.sub}>{`About ${subjectLabel}. Goes to the SPLAT team only.`}</Text>
              {sent ? (
                <Text accessibilityRole="alert" style={styles.sent}>
                  {sent}
                </Text>
              ) : (
                <>
                  <View accessibilityRole="radiogroup" style={styles.reasons}>
                    {REASONS.map((r) => (
                      <Chip
                        key={r.value}
                        role="radio"
                        label={r.label}
                        active={reason === r.value}
                        onPress={() => setReason(r.value)}
                      />
                    ))}
                  </View>
                  <TextField
                    label="What happened?"
                    accessibilityLabel="What happened?"
                    value={text}
                    onChangeText={setText}
                    multiline
                  />
                  {error ? (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {error}
                    </Text>
                  ) : null}
                  <Button
                    label="Send report"
                    loading={busy}
                    disabled={!reason || !text.trim()}
                    onPress={() => void submit()}
                  />
                </>
              )}
              <Button label={sent ? 'Done' : 'Cancel'} variant="ghost" onPress={() => setOpen(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1), minHeight: 36 },
  linkText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,37,48,0.4)' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.card,
    borderTopRightRadius: theme.radii.card,
    ...theme.shadow(4),
  },
  sheetContent: { padding: theme.spacing(5), gap: theme.spacing(3) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  sub: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  error: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.danger },
  sent: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    backgroundColor: theme.colors.mintSoft,
    borderRadius: theme.radii.field,
    padding: theme.spacing(3),
  },
})

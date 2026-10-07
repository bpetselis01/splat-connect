// packages/mobile/components/reports/report-problem.tsx
/**
 * The board's quiet "Report a problem" link, and the sheet it opens. Files a
 * member report (POST /api/reports, 065) — web's components/report-link.tsx
 * with the same six reasons and the same two confirmation lines. The person
 * reported is never told who filed it; that is the API's rule, not this file's.
 */
import { useState, type ReactNode } from 'react'
import { Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ReportSubjectKind } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
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
type Reason = (typeof REASONS)[number]['value']

// Only the reasons that can happen to what is reported: a guide never
// "arrives broken" or fails to show up. The API takes any of the six.
const REASONS_FOR: Partial<Record<ReportSubjectKind, Reason[]>> = {
  guide: ['safety', 'wrong_info', 'other'],
  toy: ['arrived_broken', 'safety', 'wrong_info', 'conduct', 'other'],
  person: ['conduct', 'safety', 'no_show', 'other'],
  organisation: ['conduct', 'safety', 'wrong_info', 'other'],
  note: ['safety', 'wrong_info', 'conduct', 'other'],
}

export function ReportProblem({
  subjectKind,
  subjectId,
  subjectLabel,
  item,
  who,
  trigger,
}: {
  subjectKind: ReportSubjectKind
  subjectId: string | null
  /** What the admin queue shows. */
  subjectLabel: string
  /** The board's words in the sheet ("this exchange"); the label when absent. */
  item?: string
  /** The other party, when there is one (MB repWho). */
  who?: string
  /** Draws the opener in place of the Report a problem link (an action row's button). */
  trigger?: (open: () => void) => ReactNode
}) {
  const bottom = useBottomClearance()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [text, setText] = useState('')
  // On by default, as the board draws it (MB contact:true); the reporter can say no.
  const [contact, setContact] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  const reasons = REASONS_FOR[subjectKind] ? REASONS.filter((r) => REASONS_FOR[subjectKind]!.includes(r.value)) : REASONS
  const close = () => setOpen(false)

  function start() {
    setReason(null)
    setText('')
    setContact(true)
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
        ok_to_contact: contact,
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
      {trigger ? (
        trigger(start)
      ) : (
        <Pressable onPress={start} accessibilityRole="button" hitSlop={8} style={styles.link}>
          <Ionicons name="flag-outline" size={14} color={theme.colors.muted} />
          <Text style={styles.linkText}>Report a problem</Text>
        </Pressable>
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          {/* The dimmed page behind the sheet: tapping it puts the sheet away. */}
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.head}>
              <Text style={styles.title} accessibilityRole="header">Tell SPLAT what happened</Text>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6} style={styles.close}>
                <Ionicons name="close" size={20} color={theme.colors.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.sheetContent, { paddingBottom: bottom }]} keyboardShouldPersistTaps="handled">
              <Text style={styles.sub}>{`About ${item ?? subjectLabel}${who ? ` · with ${who}` : ''}. Goes to the SPLAT team only.`}</Text>
              {sent ? (
                <Text accessibilityRole="alert" style={styles.sent}>
                  {sent}
                </Text>
              ) : (
                <>
                  <Text style={styles.label}>What is it about?</Text>
                  <View accessibilityRole="radiogroup" style={styles.reasons}>
                    {reasons.map((r) => (
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
                  <Pressable
                    onPress={() => setContact(!contact)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: contact }}
                    style={styles.check}
                  >
                    <View style={[styles.box, contact && styles.boxOn]}>
                      {contact ? <Ionicons name="checkmark" size={18} color={theme.colors.onColor} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.checkLabel}>OK to contact me about this</Text>
                      <Text style={styles.checkHint}>SPLAT may message you to follow up.</Text>
                    </View>
                  </Pressable>
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
                    style={styles.send}
                  />
                  {!reason || !text.trim() ? (
                    <Text style={styles.needs}>{!reason ? 'Pick what it is about, then say what happened.' : 'Say what happened to send it.'}</Text>
                  ) : null}
                </>
              )}
              {sent ? <Button label="Done" variant="secondary" onPress={close} /> : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1), minHeight: 36 },
  linkText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.scrim },
  sheet: {
    maxHeight: '88%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.card,
    borderTopRightRadius: theme.radii.card,
    ...theme.shadow(4),
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: theme.spacing(2), backgroundColor: theme.colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingHorizontal: theme.spacing(5), paddingTop: theme.spacing(3) },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSunken },
  sheetContent: { paddingHorizontal: theme.spacing(5), paddingTop: theme.spacing(2), gap: theme.spacing(4) },
  title: { flex: 1, fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  sub: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  label: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink, marginBottom: -theme.spacing(2) },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  check: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), minHeight: 48 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: theme.colors.muted, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  checkLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  checkHint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  send: { minHeight: 56 },
  needs: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, textAlign: 'center', marginTop: -theme.spacing(2) },
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

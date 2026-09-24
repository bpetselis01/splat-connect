// packages/mobile/components/printing/request-screen.tsx
/**
 * Request a print — a modal, because it is a one-shot form: the printers were
 * picked on the screen underneath, and this only says what to print.
 *
 * Parts come from the guide and default to all of them; there is no upload
 * anywhere near this form. Settings are the guide's too, so there is nothing
 * to set — the note under Pickup says so rather than drawing locked fields.
 *
 * One POST makes one job per printer, sharing a group (074). The first to
 * accept takes it and the API withdraws the rest.
 */
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { PrintDelivery, PrinterWithOwner, StlFile, Tutorial } from '@splat-connect/types'
import { apiMessage, PRINT_COLOURS } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { formatMinutes, partsMeta } from '../../lib/printing'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../auth-screen'

type Guide = Tutorial & { stl_files: StlFile[] }

const DELIVERY: Array<{ key: PrintDelivery; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'collect', label: 'I will collect', icon: 'walk-outline' },
  { key: 'post', label: 'Post it to me', icon: 'mail-outline' },
]

function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>
}

export function RequestPrintScreen({ guideId, printerIds }: { guideId: string; printerIds: string[] }) {
  const router = useRouter()
  const [guide, setGuide] = useState<Guide | null>(null)
  const [printers, setPrinters] = useState<PrinterWithOwner[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [parts, setParts] = useState<string[]>([])
  const [colour, setColour] = useState<string>(PRINT_COLOURS[0])
  const [delivery, setDelivery] = useState<PrintDelivery>('collect')
  const [note, setNote] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiClient.get<Guide>(`/api/public/tutorials/${guideId}`),
      apiClient.get<PrinterWithOwner[]>('/api/printers'),
    ])
      .then(([g, p]) => {
        setGuide(g)
        setParts(g.stl_files.map((f) => f.id))
        setPrinters(p.filter((x) => printerIds.includes(x.id)))
      })
      .catch((err) => {
        console.error('[RequestPrintScreen] load failed:', err)
        setLoadFailed(true)
      })
    // printerIds is a fresh array per render of the route; its string is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideId, printerIds.join(',')])

  if (loadFailed) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load this guide." hint="Check your connection and try again." />
      </Screen>
    )
  }
  if (!guide) {
    return (
      <Screen>
        <SkeletonRow />
      </Screen>
    )
  }

  const ticked = guide.stl_files.filter((f) => parts.includes(f.id))
  const valid = ticked.length > 0 && printerIds.length > 0 && agree

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const created = await apiClient.post<{ id: string }>('/api/toy-transactions/print', {
        printer_ids: printerIds,
        tutorial_id: guideId,
        stl_file_ids: parts,
        note: note.trim() || undefined,
        colour,
        delivery,
      })
      router.replace(`/printing/jobs/${created.id}`)
    } catch (err) {
      setError(apiMessage(err, 'That did not send. Check your connection and try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View>
          <Eyebrow>Asking</Eyebrow>
          <View style={styles.row}>
            {printers.map((p) => (
              <Text key={p.id} style={styles.asking}>
                {p.org_name ?? p.owner_name ?? 'A contributor'}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Eyebrow>Parts</Eyebrow>
          {guide.stl_files.map((f) => {
            const on = parts.includes(f.id)
            return (
              <Pressable
                key={f.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Include ${f.filename}`}
                onPress={() => setParts((cur) => (on ? cur.filter((id) => id !== f.id) : [...cur, f.id]))}
                style={[styles.part, on && styles.partOn]}
              >
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={on ? theme.colors.primaryDark : theme.colors.muted}
                />
                <View style={styles.flex}>
                  <Text style={styles.partName}>{f.filename}</Text>
                  <Text style={styles.meta}>
                    {[f.material, f.print_minutes != null ? formatMinutes(f.print_minutes) : null].filter(Boolean).join(' · ') ||
                      'Settings from the guide'}
                  </Text>
                </View>
                <Text style={styles.meta}>×1</Text>
              </Pressable>
            )
          })}
          <Text style={styles.meta}>
            {[`${ticked.length} of ${guide.stl_files.length} parts`, partsMeta(ticked)].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <View style={styles.group}>
          <Eyebrow>Colour</Eyebrow>
          <View accessibilityRole="radiogroup" style={styles.row}>
            {PRINT_COLOURS.map((c) => (
              <Chip key={c} label={c} role="radio" active={colour === c} onPress={() => setColour(c)} />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Eyebrow>Pickup</Eyebrow>
          <View accessibilityRole="radiogroup" style={styles.row}>
            {DELIVERY.map((d) => (
              <Pressable
                key={d.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: delivery === d.key }}
                accessibilityLabel={d.label}
                onPress={() => setDelivery(d.key)}
                style={[styles.option, delivery === d.key && styles.partOn]}
              >
                <Ionicons name={d.icon} size={18} color={theme.colors.primaryDark} />
                <Text style={styles.partName}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <TextField
          label="Note to the printer (optional)"
          accessibilityLabel="Note to the printer"
          placeholder="e.g. It is for a cot rail about 22 mm across"
          value={note}
          onChangeText={setNote}
          maxLength={1000}
          multiline
          style={styles.note}
        />

        <View style={styles.info}>
          <Ionicons name="information-circle" size={18} color={theme.colors.ink} />
          <Text style={[styles.meta, styles.flex, styles.infoText]}>
            The printer gives the time and the machine; you cover the filament. Settings come from the guide,
            so the printer cannot change them by mistake.
          </Text>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agree }}
          onPress={() => setAgree((v) => !v)}
          style={[styles.part, agree && styles.agreeOn]}
        >
          <Ionicons
            name={agree ? 'checkbox' : 'square-outline'}
            size={24}
            color={agree ? theme.colors.success : theme.colors.muted}
          />
          <Text style={[styles.partName, styles.flex]}>
            I understand I cover the filament, and that I settle it with the printer, not through SPLAT.
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <ErrorRow message={error} />
        <Button label="Send request" disabled={!valid} loading={busy} onPress={send} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: theme.spacing(6), gap: theme.spacing(5) },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginBottom: theme.spacing(2),
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  group: { gap: theme.spacing(2) },
  asking: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
    overflow: 'hidden',
  },
  part: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    minHeight: 60,
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  partOn: { borderColor: theme.colors.primaryDark, backgroundColor: theme.colors.accentLight },
  agreeOn: { borderColor: theme.colors.success, backgroundColor: theme.colors.mintSoft },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(3),
    minHeight: 50,
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  partName: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19 },
  note: { minHeight: 80, textAlignVertical: 'top' },
  info: {
    flexDirection: 'row',
    gap: theme.spacing(2),
    padding: theme.spacing(3),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.honeySoft,
  },
  infoText: { color: theme.colors.ink },
  footer: {
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing(3),
  },
})

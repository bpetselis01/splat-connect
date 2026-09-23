// packages/mobile/components/ui/DateTimeField.tsx
/**
 * A date or a time, picked with the system's own picker.
 *
 * The value is the same string a typed field would hold — `2026-10-18` for a
 * date, `10:00` for a time — so a form validates one shape whichever platform
 * filled it.
 *
 * - Android: the field opens the system dialog (DateTimePickerAndroid.open).
 * - iOS: the field opens the calendar or the time wheel beneath it, with Done.
 * - Web: the picker has no web build (it renders null), so the field is typed.
 *
 * An empty value says "Choose a date", not today's: a date the leader never
 * chose must not look chosen. `placeholder` is the typed web field's example.
 */
import { useState } from 'react'
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { TextField } from './TextField'

type Mode = 'date' | 'time'

const pad = (n: number) => String(n).padStart(2, '0')

/** `2026-10-18` or `10:00`, on the device's own clock. */
export function formatPicked(at: Date, mode: Mode): string {
  return mode === 'date'
    ? `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
    : `${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** The string back as a Date for the picker to open on, or `fallback`. */
export function parsePicked(value: string, mode: Mode, fallback: Date): Date {
  const at = new Date(fallback)
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const t = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (mode === 'date' && d) at.setFullYear(+d[1], +d[2] - 1, +d[3])
  else if (mode === 'time' && t) at.setHours(+t[1], +t[2], 0, 0)
  return at
}

/** What the field reads, in words: "Sat 18 Oct 2026", "10:00 am". */
function spoken(value: string, mode: Mode): string {
  const at = parsePicked(value, mode, new Date())
  return mode === 'date'
    ? at.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : at.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

export function DateTimeField({
  label,
  value,
  onChange,
  mode,
  placeholder,
  minimumDate,
  openOn,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  mode: Mode
  placeholder: string
  minimumDate?: Date
  /** Where an empty picker starts. Defaults to now. */
  openOn?: Date
}) {
  const [open, setOpen] = useState(false)

  if (Platform.OS === 'web') {
    return (
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType="numbers-and-punctuation"
        maxLength={mode === 'date' ? 10 : 5}
      />
    )
  }

  const current = parsePicked(value, mode, openOn ?? new Date())
  const pick = (_: unknown, at: Date) => onChange(formatPicked(at, mode))

  function press() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode, is24Hour: false, minimumDate, onValueChange: pick })
    } else {
      // Opening shows a value, so it takes one: otherwise Done on an untouched
      // wheel would close with the field still empty while the wheel showed a time.
      if (!open && !value) onChange(formatPicked(current, mode))
      setOpen(!open)
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ? spoken(value, mode) : 'not set'}`}
        accessibilityHint={mode === 'date' ? 'Opens a calendar' : 'Opens a time picker'}
        style={[styles.box, open && styles.boxOpen]}
      >
        <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={18} color={theme.colors.muted} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? spoken(value, mode) : mode === 'date' ? 'Choose a date' : 'Choose a time'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.sheet}>
          <DateTimePicker
            value={current}
            mode={mode}
            display={mode === 'date' ? 'inline' : 'spinner'}
            minimumDate={minimumDate}
            accentColor={theme.colors.primary}
            themeVariant="light"
            onValueChange={pick}
          />
          <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // TextField's own box, so the two sit in one form without a seam.
  field: { marginBottom: theme.spacing(4) },
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text, marginBottom: theme.spacing(1) },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    minHeight: 48,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
  },
  boxOpen: { borderColor: theme.colors.primary },
  value: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.text },
  placeholder: { color: theme.colors.muted },
  sheet: { marginTop: theme.spacing(2), borderRadius: theme.radii.panel, backgroundColor: theme.colors.surface, paddingBottom: theme.spacing(2), ...theme.shadow(1) },
  done: { alignSelf: 'flex-end', paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(2), minHeight: 44, justifyContent: 'center' },
  doneText: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.primaryDark },
})

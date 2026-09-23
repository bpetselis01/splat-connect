// packages/mobile/components/organisation/org-profile-edit-screen.tsx
/**
 * The organisation profile editor — web's /dashboard/organisation/profile, the
 * words half of it: who you are, where, and how to reach you, plus the thanks
 * notes a leader can hide. Publishes on save, with no review.
 *
 * Pictures, doors, rate lines and the capability / material pickers stay on
 * web's form; PATCH /profile only writes the fields it is sent, so saving here
 * leaves those untouched.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { AU_STATES, type Organization, type OrgThanks } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'

const FIELDS = [
  ['name', 'Organisation name', 120],
  ['kind', 'What you are', 60],
  ['description', 'One line, for the badge on a guide', 500],
  ['about', 'The paragraph at the top of your page', 4000],
  ['suburb', 'Suburb', 80],
  ['visit_hours', 'When to visit', 120],
  ['service_area', 'Where you help', 120],
  ['contact_email', 'Public email', 200],
  ['contact_phone', 'Public phone', 40],
  ['website_url', 'Website', 300],
] as const

type Field = (typeof FIELDS)[number][0] | 'state'

export function OrgProfileEditScreen() {
  const { caps } = useCapabilities()
  const orgId = caps?.ledOrgs[0]?.id
  const [form, setForm] = useState<Record<Field, string> | null>(null)
  const [thanks, setThanks] = useState<OrgThanks[]>([])
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!orgId) return
      apiClient.get<Organization>(`/api/organizations/${orgId}`).then((org) =>
        setForm(
          Object.fromEntries(
            [...FIELDS.map(([k]) => k), 'state'].map((k) => [k, String((org as unknown as Record<string, unknown>)[k] ?? '')])
          ) as Record<Field, string>
        )
      )
      apiClient.get<OrgThanks[]>(`/api/organizations/${orgId}/thanks`).then(setThanks).catch(() => setThanks([]))
    }, [orgId])
  )

  async function save() {
    if (!form || !orgId) return
    setSaving(true)
    setNote(null)
    try {
      await apiClient.patch(`/api/organizations/${orgId}/profile`, { ...form, name: form.name.trim() })
      setNote({ ok: true, text: 'Saved. It is on your public page now.' })
    } catch (err) {
      const detail = err instanceof Error ? /: (.+)$/.exec(err.message)?.[1] : null
      setNote({ ok: false, text: detail ?? 'That did not save. Check your connection and try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function setHidden(t: OrgThanks, hidden: boolean) {
    const row = await apiClient.patch<OrgThanks>(`/api/organizations/${orgId}/thanks/${t.profile_id}`, { hidden })
    setThanks((all) => all.map((x) => (x.profile_id === t.profile_id ? row : x)))
  }

  if (!form) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  const notes = thanks.filter((t) => t.note)

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.lede}>
          This is the page a family lands on before they ask you for anything. It publishes the moment you save.
          Pictures, doors and rates are edited on the web.
        </Text>
        {FIELDS.map(([key, label, max]) => (
          <TextField
            key={key}
            label={label}
            value={form[key]}
            maxLength={max}
            multiline={key === 'about' || key === 'description'}
            onChangeText={(v) => setForm({ ...form, [key]: v })}
            autoCapitalize={key === 'contact_email' || key === 'website_url' ? 'none' : 'sentences'}
            keyboardType={key === 'contact_email' ? 'email-address' : key === 'contact_phone' ? 'phone-pad' : key === 'website_url' ? 'url' : 'default'}
          />
        ))}
        <Text style={styles.label}>State</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {AU_STATES.map((s) => (
            <Chip key={s} role="radio" label={s} active={form.state === s} onPress={() => setForm({ ...form, state: s })} />
          ))}
        </View>
        {note ? <Text style={[styles.note, { color: note.ok ? theme.colors.success : theme.colors.danger }]}>{note.text}</Text> : null}
        <Button label="Save and publish" onPress={() => void save()} loading={saving} />

        <Text style={styles.section}>Thanks from families</Text>
        <Text style={styles.lede}>
          {thanks.length} {thanks.length === 1 ? 'family has' : 'families have'} said thanks. A note shows on your page only
          if its author said it could; hide one and it comes off the page, but still counts.
        </Text>
        {notes.map((t) => {
          const onPage = t.show_note && !t.hidden_at
          return (
            <Card key={t.profile_id} style={styles.thanks}>
              <Text style={styles.quote}>“{t.note}”</Text>
              <Text style={styles.meta}>
                {t.byline ?? 'A family'} · {!t.show_note ? 'Just for you' : onPage ? 'On your page' : 'Hidden'}
              </Text>
              {t.show_note ? (
                <Button label={onPage ? 'Hide' : 'Show again'} variant="ghost" onPress={() => void setHidden(t, onPage)} />
              ) : null}
            </Card>
          )
        })}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(3), paddingBottom: theme.spacing(10) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  note: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption },
  section: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.text, marginTop: theme.spacing(4) },
  thanks: { padding: theme.spacing(3), gap: theme.spacing(1) },
  quote: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
})

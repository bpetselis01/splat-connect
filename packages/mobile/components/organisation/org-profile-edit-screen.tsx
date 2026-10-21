// packages/mobile/components/organisation/org-profile-edit-screen.tsx
/**
 * The organisation profile editor — web's /dashboard/organisation/profile, the
 * words half of it: who you are, where, and how to reach you, plus the thanks
 * notes a leader can hide. Publishes on save, with no review.
 *
 * Pictures, doors, rate lines, payment methods, capabilities and recycling are
 * here too (sections/). Saving is three writes like web's: the profile PATCH,
 * then the doors and rate lines, each a full-replace PUT of the local list. A
 * failure keeps every local edit on screen.
 */
import { logFailure } from '../../lib/log'
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { apiMessage, AU_STATES, isNetworkError, type Organization, type OrgThanks } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useActingOrg } from '../../lib/acting-org'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ListSection } from '../list/list-kit'
import { OrgLeadersSection } from './org-leaders-section'
import { OrgPictures } from './sections/org-pictures'
import { OrgDoors } from './sections/org-doors'
import { OrgRates } from './sections/org-rates'
import { OrgOffers } from './sections/org-offers'
import { readLists, type DoorDraft, type RateDraft } from '../../lib/org-lists'

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

type Field = (typeof FIELDS)[number][0] | 'state' | 'rate_note' | 'recycling_note'
const TEXT_KEYS: Field[] = [...FIELDS.map(([k]) => k), 'state', 'rate_note', 'recycling_note']

export function OrgProfileEditScreen() {
  const { org: acting, refresh } = useActingOrg()
  const orgId = acting?.id
  const [form, setForm] = useState<Record<Field, string> | null>(null)
  const [orig, setOrig] = useState<{ logo: string | null; cover: string | null }>({ logo: null, cover: null })
  const [logo, setLogo] = useState<string | null>(null)
  const [cover, setCover] = useState<string | null>(null)
  const [doors, setDoors] = useState<DoorDraft[]>([])
  const [lines, setLines] = useState<RateDraft[]>([])
  const [payments, setPayments] = useState<string[]>([])
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [materials, setMaterials] = useState<string[]>([])
  const [thanks, setThanks] = useState<OrgThanks[]>([])
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [loadFailed, setLoadFailed] = useState<'offline' | 'other' | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useFocusEffect(
    useCallback(() => {
      if (!orgId) return
      apiClient
        .get<Organization>(`/api/organizations/${orgId}`)
        .then((org) => {
          setForm(
            Object.fromEntries(
              TEXT_KEYS.map((k) => [k, String((org as unknown as Record<string, unknown>)[k] ?? '')])
            ) as Record<Field, string>
          )
          setOrig({ logo: org.logo_url ?? null, cover: org.cover_url ?? null })
          setLogo(org.logo_url ?? null)
          setCover(org.cover_url ?? null)
          setDoors((org.doors ?? []).map((d) => ({ key: d.id, title: d.title, body: d.body ?? '', target: d.target })))
          setLines(
            (org.rate_lines ?? []).map((l) => ({
              key: l.id,
              description: l.description,
              amount: (l.amount_cents / 100).toFixed(2),
              claiming: l.claiming,
            }))
          )
          setPayments(org.payment_methods ?? [])
          setCapabilities(org.capabilities ?? [])
          setMaterials(org.recycling_materials ?? [])
        })
        .catch((err) => {
          logFailure('[OrgProfileEditScreen] load failed:', err)
          setLoadFailed(isNetworkError(err) ? 'offline' : 'other')
        })
      apiClient.get<OrgThanks[]>(`/api/organizations/${orgId}/thanks`).then(setThanks).catch(() => setThanks([]))
    }, [orgId, reloadKey])
  )

  async function save() {
    if (!form || !orgId) return
    const parsed = readLists(doors, lines, form.rate_note)
    if ('error' in parsed) {
      setNote({ ok: false, text: parsed.error })
      return
    }
    setSaving(true)
    setNote(null)
    try {
      await apiClient.patch(`/api/organizations/${orgId}/profile`, {
        ...form,
        name: form.name.trim(),
        payment_methods: payments,
        capabilities,
        recycling_materials: materials,
        // A picture is written by its upload; saving can only take one down.
        ...(orig.logo && !logo ? { logo_url: null } : {}),
        ...(orig.cover && !cover ? { cover_url: null } : {}),
      })
      await Promise.all([
        apiClient.put(`/api/organizations/${orgId}/doors`, { doors: parsed.doors }),
        apiClient.put(`/api/organizations/${orgId}/rate-lines`, { lines: parsed.lines }),
      ])
      setOrig({ logo, cover })
      setNote({ ok: true, text: 'Saved. It is on your public page now.' })
    } catch (err) {
      setNote({ ok: false, text: apiMessage(err, 'That did not save. Check your connection and try again.') })
    } finally {
      setSaving(false)
    }
  }

  async function setHidden(t: OrgThanks, hidden: boolean) {
    try {
      const row = await apiClient.patch<OrgThanks>(`/api/organizations/${orgId}/thanks/${t.profile_id}`, { hidden })
      setThanks((all) => all.map((x) => (x.profile_id === t.profile_id ? row : x)))
    } catch (err) {
      setNote({ ok: false, text: apiMessage(err, 'That did not save. Check your connection and try again.') })
    }
  }

  if (!form && loadFailed) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title={loadFailed === 'offline' ? 'You seem to be offline.' : 'Could not load your page.'}
          hint="Check your connection and try again."
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => {
              setLoadFailed(null)
              setReloadKey((k) => k + 1)
            }}
          />
        </EmptyState>
      </Screen>
    )
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
        </Text>
        <OrgPictures
          orgId={orgId!}
          logo={logo}
          cover={cover}
          onChange={(slot, url) => (slot === 'logo' ? setLogo(url) : setCover(url))}
        />
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
        <ListSection style={styles.group}>State</ListSection>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {AU_STATES.map((s) => (
            <Chip key={s} role="radio" label={s} active={form.state === s} onPress={() => setForm({ ...form, state: s })} />
          ))}
        </View>
        <OrgOffers
          capabilities={capabilities}
          onCapabilities={setCapabilities}
          materials={materials}
          onMaterials={setMaterials}
          recyclingNote={form.recycling_note}
          onRecyclingNote={(v) => setForm({ ...form, recycling_note: v })}
        />
        <OrgDoors doors={doors} onChange={setDoors} />
        <OrgRates
          lines={lines}
          onLines={setLines}
          note={form.rate_note}
          onNote={(v) => setForm({ ...form, rate_note: v })}
          payments={payments}
          onPayments={setPayments}
        />
        {note ? <Text style={[styles.note, { color: note.ok ? theme.colors.success : theme.colors.danger }]}>{note.text}</Text> : null}
        <Button label="Save and publish" onPress={() => void save()} loading={saving} style={styles.primary} />

        <OrgLeadersSection orgId={orgId!} onSteppedDown={() => void refresh()} />

        <ListSection style={styles.group}>Thanks from families</ListSection>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  note: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption },
  group: { marginTop: theme.spacing(3), marginBottom: 0 },
  // The board's full-width pill save.
  primary: { borderRadius: theme.radii.pill, minHeight: 52, borderWidth: 0 },
  thanks: { padding: 15, gap: theme.spacing(1), borderRadius: theme.radii.panel, ...theme.shadow(1) },
  quote: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
})

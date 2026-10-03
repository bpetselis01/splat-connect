// packages/mobile/components/organisation/org-profile-screen.tsx
/**
 * An organisation's public profile — the board's "Organisation profile", a
 * full port of the web page in reading order: who they are and the three
 * buttons, what they do, what they charge and take, how to use them, what they
 * back, who they are, where and when.
 *
 * Every number is counted by the API, never typed by the organisation. The
 * Visit card names the suburb only: the street address reaches a family once a
 * leader accepts them, never from here.
 *
 * Follow / Message / Say thanks (077) need an account; signed out they go to
 * sign-in. A leader of the org sees none of them — they would be following and
 * thanking themselves — and their organisation's messages are on Me.
 */
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Image, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  PAYMENT_METHODS,
  OFFER_SHORT_LABEL,
  formatCents,
  apiMessage,
  firstName,
  gradeOf,
  guideMeta,
  initials,
  orgPrintFacts,
  recyclingPerDrop,
} from '@splat-connect/types'
import type { OrgDoorTarget, OrgPublicProfile, OrgRelationship, RecyclingGives, Tutorial } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useAuth } from '../../lib/auth-context'
import { useCapabilities } from '../../lib/capabilities'
import { doorRoute, sinceYear } from '../../lib/org-profile'
import { recordRecent } from '../../lib/recents'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { Card } from '../ui/Card'
import { ToBeCompleted } from '../ui/ToBeCompleted'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'
import { ReportProblem } from '../reports/report-problem'
import { ListRow, RowThumb } from '../list/list-kit'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const DOOR_ICON: Record<OrgDoorTarget, IconName> = {
  toy_library: 'gift-outline',
  events: 'calendar-outline',
  dropoff: 'leaf-outline',
  print: 'print-outline',
  build: 'construct-outline',
  message: 'chatbubble-ellipses-outline',
}
const QUOTE_TINTS = [theme.colors.mintSoft, theme.colors.honeySoft, theme.colors.violetSoft, theme.colors.accentLight]

// MB's org profile words for 113's recycling_gives.
const GIVES_PROFILE: Record<RecyclingGives, string> = {
  credit: 'Print credit on their machines',
  spool: 'A spool to take home',
  either: 'Credit, or a spool',
}

export function OrgProfileScreen({ id }: { id: string }) {
  const router = useRouter()
  const { session } = useAuth()
  const { caps } = useCapabilities()
  const [org, setOrg] = useState<OrgPublicProfile | null>(null)
  const [me, setMe] = useState<OrgRelationship | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [allGuides, setAllGuides] = useState(false)
  const [allToys, setAllToys] = useState(false)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(false)
    Promise.all([
      apiClient.get<OrgPublicProfile>(`/api/public/organizations/${id}`),
      // Signed out there is no relationship to read; the buttons go to sign-in.
      session ? apiClient.get<OrgRelationship>(`/api/organizations/${id}/me`).catch(() => null) : Promise.resolve(null),
    ])
      .then(([profile, rel]) => {
        if (ignore) return
        setOrg(profile)
        setMe(rel)
      })
      .catch((err) => {
        console.error('[OrgProfileScreen] fetch failed:', err)
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id, session, reloadKey])

  // "Pick up where you left off": once per open, when the profile has loaded.
  useEffect(() => {
    if (!org) return
    const toys = org.toysShared.length
    recordRecent({
      id: org.id,
      kind: 'organisation',
      title: org.name,
      subtitle: toys > 0 ? `Organisation · ${toys} toy${toys === 1 ? '' : 's'}` : 'Organisation',
      badge: org.verified_at ? 'Verified' : undefined,
      href: `/toy-library/organisation/${org.id}`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id])

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    )
  }

  if (error || !org) {
    return (
      <View style={styles.container}>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load this organisation." hint="Check your connection and try again.">
          <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
        </EmptyState>
      </View>
    )
  }

  const guides: Tutorial[] = [
    ...org.tutorialsApproved,
    ...org.tutorialsBacked.filter((t) => !org.tutorialsApproved.some((a) => a.id === t.id)),
  ]
  const place = [org.suburb, org.state].filter(Boolean).join(', ')
  const since = sinceYear(org.created_at)
  const doors = org.doors ?? []
  const rateLines = org.rate_lines ?? []
  const printers = org.printers ?? []
  const materials = [...new Set(printers.flatMap((p) => p.materials))]
  const payments = PAYMENT_METHODS.filter((m) => org.payment_methods?.includes(m.value)).map((m) => m.label)
  const prints = printers.length > 0 || rateLines.length > 0 || !!org.rate_note
  const recycles = (org.recycling_materials ?? []).length > 0
  const stats = [
    { n: org.counts?.guidesBacked ?? org.tutorialsBacked.length, label: 'guides backed' },
    { n: org.counts?.toysDelivered ?? org.toysDelivered.length, label: 'toys delivered' },
    { n: org.counts?.partsPrinted ?? 0, label: 'parts printed' },
    { n: org.counts?.familiesHelped ?? 0, label: 'families helped' },
  ]
  const activity = [
    ...(org.stories ?? []).map((s) => ({ key: `s-${s.id}`, t: `Published a story — ${s.title}`, when: s.created_at })),
    ...(org.events ?? []).map((e) => ({
      key: `e-${e.id}`,
      t: `${e.title} — ${e.format === 'online' ? 'Online' : e.location}`,
      when: e.starts_at,
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1))
  const meta = [org.kind ?? org.description, place, since ? `On SPLAT since ${since}` : null].filter(Boolean).join(' · ')

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.cover}>
        {org.cover_url ? <Image source={{ uri: org.cover_url }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors /> : null}
      </View>
      <View style={styles.logo}>
        {org.logo_url ? (
          <Image source={{ uri: org.logo_url }} style={StyleSheet.absoluteFill} accessibilityLabel={`${org.name} logo`} />
        ) : (
          <Text style={styles.logoInitial}>{org.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>

      {org.verified_at ? (
        <View style={styles.verified}>
          <Ionicons name="shield-checkmark" size={14} color={theme.colors.ink} />
          <Text style={styles.verifiedText}>Verified by SPLAT</Text>
        </View>
      ) : null}
      <Text style={styles.name} accessibilityRole="header">{org.name}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {(org.thanks_count ?? 0) > 0 ? (
        <Text style={styles.thanked}>
          Thanked {org.thanks_count} {org.thanks_count === 1 ? 'time' : 'times'}
        </Text>
      ) : null}
      {(org.capabilities ?? []).length > 0 ? (
        <View style={styles.chips}>
          {(org.capabilities ?? []).map((c) => (
            <Text key={c} style={styles.capability}>{c}</Text>
          ))}
        </View>
      ) : null}

      <OrgButtons
        orgId={org.id}
        orgName={org.name}
        me={me}
        signedIn={!!session}
        byline={firstName(caps?.profile.name)}
        onThanked={() => setOrg({ ...org, thanks_count: (org.thanks_count ?? 0) + 1 })}
      />

      {org.about ? <Text style={styles.body}>{org.about}</Text> : null}
      <View style={styles.stats}>
        {stats.map((k) => (
          <Card key={k.label} style={styles.stat}>
            <Text style={styles.statN}>{k.n}</Text>
            <Text style={styles.statLabel}>{k.label}</Text>
          </Card>
        ))}
      </View>

      {prints || recycles ? (
        <Section title="What they charge, and what they take" hint="Their declared rates, and the plastic their machines can handle.">
          {prints ? (
            <View style={[styles.panel, { backgroundColor: theme.colors.honeySoft }]}>
              <Text style={styles.panelTitle}>They print — you cover the filament</Text>
              {printers.length > 0 ? <Fact k="Machines" v={printers.map((p) => p.name).join(' · ')} /> : null}
              {materials.length > 0 ? <Fact k="Materials" v={materials.join(' · ')} /> : null}
              {orgPrintFacts(org.print_stats).map((f) => (
                <Fact key={f.k} k={f.k} v={f.v} />
              ))}
              {rateLines.map((l) => (
                <Fact
                  key={l.id}
                  k={l.description}
                  v={l.claiming ? formatCents(l.amount_cents) : `${formatCents(l.amount_cents)} — they cover it`}
                />
              ))}
              {payments.length > 0 ? <Fact k="Paid back by" v={payments.join(' · ')} /> : null}
              {org.rate_note ? <Text style={styles.quote}>“{org.rate_note}”</Text> : null}
              <Button
                label="Ask them to print"
                variant="secondary"
                onPress={() => router.push({ pathname: '/printing', params: { printWith: org.id } })}
              />
            </View>
          ) : null}
          {recycles ? (
            <View style={[styles.panel, { backgroundColor: theme.colors.mintSoft }]}>
              <Text style={styles.panelTitle}>They take waste plastic</Text>
              <Fact k="Polymers" v={(org.recycling_materials ?? []).join(' · ')} />
              {(org.recycling_forms ?? []).length ? <Fact k="Form" v={org.recycling_forms!.join(', ')} /> : null}
              <Fact k="Per drop" v={recyclingPerDrop(org)} />
              <Fact k="You get" v={GIVES_PROFILE[org.recycling_gives ?? 'credit']} />
              {org.recycling_hours ? <Fact k="When" v={org.recycling_hours} /> : null}
              {org.recycling_note ? <Text style={styles.panelBody}>{org.recycling_note}</Text> : null}
              <Button label="Book a drop-off" variant="secondary" onPress={() => router.push('/explore/recycling')} />
            </View>
          ) : null}
        </Section>
      ) : null}

      {doors.length > 0 ? (
        <Section title="How to work with them" hint={`${doors.length === 1 ? 'One door' : `${doors.length} doors`}. None need a referral.`}>
          {doors.map((d) => {
            const to = doorRoute(d.target, org.id)
            const inner = (
              <Card style={styles.door}>
                <Ionicons name={DOOR_ICON[d.target]} size={22} color={theme.colors.primaryDeep} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{d.title}</Text>
                  {d.body ? <Text style={styles.rowMeta}>{d.body}</Text> : null}
                </View>
                {to ? <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} /> : null}
              </Card>
            )
            return to ? (
              <AnimatedPressable key={d.id} onPress={() => router.push(to as never)} accessibilityRole="button" accessibilityLabel={d.title}>
                {inner}
              </AnimatedPressable>
            ) : (
              <View key={d.id}>{inner}</View>
            )
          })}
        </Section>
      ) : null}

      {guides.length > 0 ? (
        <Section
          title={<>Guides they back <Text style={styles.count}>{guides.length}</Text></>}
          hint="Backing means a leader read it, checked the safety list and built it once. Their name is on it."
          action={guides.length > 4 && !allGuides ? { label: `All ${guides.length} →`, onPress: () => setAllGuides(true) } : undefined}
        >
          {(allGuides ? guides : guides.slice(0, 4)).map((g) => (
            <ListRow
              key={g.id}
              title={g.title}
              // The author on the meta's second line, as MB:1199 puts g.by under g.meta.
              meta={[guideMeta(g, g.parts_total_cents != null ? formatCents(g.parts_total_cents) : null), g.author_name].filter(Boolean).join('\n')}
              thumb={<RowThumb photo={g.toy_photo_url} glyph="color-wand-outline" />}
              onPress={() => router.push({ pathname: '/guides/[id]', params: { id: g.id } })}
              accessibilityLabel={g.title}
            />
          ))}
        </Section>
      ) : null}

      {org.toysShared.length > 0 ? (
        <Section
          title={<>Toys on their shelf <Text style={styles.count}>{org.toysShared.length}</Text></>}
          action={org.toysShared.length > 4 && !allToys ? { label: 'See all →', onPress: () => setAllToys(true) } : undefined}
        >
          {(allToys ? org.toysShared : org.toysShared.slice(0, 4)).map((t) => (
            <ListRow
              key={t.id}
              title={t.name}
              meta={[t.offer_type ? OFFER_SHORT_LABEL[t.offer_type] : null, gradeOf(t.condition).label].filter(Boolean).join(' · ')}
              thumb={<RowThumb photo={t.cover_photo_url} glyph="cube-outline" />}
              onPress={() => router.push({ pathname: '/toy-library/[id]', params: { id: t.id } })}
              accessibilityLabel={t.name}
            />
          ))}
        </Section>
      ) : null}

      {(org.fromFamilies ?? []).length > 0 ? (
        <Section title="From families">
          {(org.fromFamilies ?? []).map((q, i) => (
            <View key={`${q.source}-${q.at}-${i}`} style={[styles.panel, { backgroundColor: QUOTE_TINTS[i % QUOTE_TINTS.length] }]}>
              <Text style={styles.panelBody}>“{q.quote}”</Text>
              <Text style={styles.by}>{q.by}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {(org.leaders ?? []).length > 0 ? (
        <Section title="Leaders" hint="The people whose names go on the guides.">
          {(org.leaders ?? []).map((l, i) => (
            <Card key={`${l.name}-${i}`} style={[styles.row, styles.leaderRow]}>
              <View style={styles.leaderAvatar}>
                <Text style={styles.leaderInitials}>{initials(l.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{l.name}</Text>
                <Text style={styles.rowMeta}>
                  {l.guides_backed} {l.guides_backed === 1 ? 'guide' : 'guides'} backed
                </Text>
              </View>
            </Card>
          ))}
        </Section>
      ) : null}

      {place || org.visit_hours || org.service_area || org.website_url ? (
        <Section title="Visit">
          {/* PENDING(org-visit-map): a map and the street address with access notes — no maps provider yet, so it says To be completed. */}
          <Card style={styles.visit}>
            {place ? <Fact k="Where" v={place} /> : null}
            {org.visit_hours ? <Fact k="When" v={org.visit_hours} /> : null}
            {org.service_area ? <Fact k="Area" v={org.service_area} /> : null}
            {org.website_url ? <Fact k="Website" v={org.website_url.replace(/^https?:\/\//, '')} /> : null}
            <Text style={styles.rowMeta}>The street address comes once they accept you.</Text>
            <ToBeCompleted compact subject="Map and address">
              A map and the street address will appear here once they are set up.
            </ToBeCompleted>
          </Card>
        </Section>
      ) : null}

      {activity.length > 0 ? (
        <Section title="Recent activity">
          {activity.map((f) => (
            <Card key={f.key} style={styles.row}>
              <Text style={styles.rowTitle}>{f.t}</Text>
              <Text style={styles.rowMeta}>{new Date(f.when).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</Text>
            </Card>
          ))}
        </Section>
      ) : null}

      <View style={styles.reportLine}>
        <Text style={styles.reportText}>Something wrong here? </Text>
        <ReportProblem subjectKind="organisation" subjectId={org.id} subjectLabel={org.name} item={`${org.name} profile`} />
        <Text style={styles.reportText}>. Goes to SPLAT only.</Text>
      </View>
    </ScrollView>
  )
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: React.ReactNode
  hint?: string
  action?: { label: string; onPress: () => void }
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} hitSlop={8}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factK}>{k}</Text>
      <Text style={styles.factV}>{v}</Text>
    </View>
  )
}

/**
 * The three buttons, and the thanks form they open. The form is inline rather
 * than a sheet: three fields, one tick, and it closes for good once sent.
 */
function OrgButtons({
  orgId,
  orgName,
  me,
  signedIn,
  byline: initialByline,
  onThanked,
}: {
  orgId: string
  orgName: string
  me: OrgRelationship | null
  signedIn: boolean
  byline: string
  onThanked: () => void
}) {
  const router = useRouter()
  const [following, setFollowing] = useState(me?.following ?? false)
  const [thanked, setThanked] = useState(!!me?.thanks)
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [byline, setByline] = useState(initialByline)
  const [show, setShow] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFollowing(me?.following ?? false)
    setThanked(!!me?.thanks)
  }, [me])

  const toggleFollow = useCallback(async () => {
    if (!signedIn) return router.push('/sign-in')
    setBusy(true)
    setError(null)
    try {
      if (following) await apiClient.delete(`/api/organizations/${orgId}/follow`)
      else await apiClient.post(`/api/organizations/${orgId}/follow`, {})
      setFollowing(!following)
    } catch (err) {
      setError(apiMessage(err, 'That did not go through. Try again.'))
    } finally {
      setBusy(false)
    }
  }, [signedIn, following, orgId, router])

  if (me?.leads) {
    return (
      <Card variant="feature" style={styles.leads}>
        <Text style={styles.rowTitle}>You lead {orgName}.</Text>
        <Text style={styles.rowMeta}>Families write to you under Me → Organisation → Messages.</Text>
      </Card>
    )
  }

  async function sendThanks() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/organizations/${orgId}/thanks`, { note, byline, show_note: show })
      setThanked(true)
      setAsking(false)
      onThanked()
    } catch (err) {
      // Thanked already, from another device: the same end state.
      if (err instanceof Error && /status 409/.test(err.message)) {
        setThanked(true)
        setAsking(false)
      } else setError(apiMessage(err, 'That did not send. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.actions}>
      <View style={styles.buttonRow}>
        <Button
          label={following ? 'Following' : 'Follow'}
          variant="secondary"
          disabled={busy}
          onPress={() => void toggleFollow()}
          style={styles.flex}
        />
        <Button
          label="Message"
          onPress={() =>
            router.push(
              signedIn ? { pathname: '/messages/org/[orgId]', params: { orgId, name: orgName } } : '/sign-in'
            )
          }
          style={styles.flex}
        />
      </View>
      <Button
        label={thanked ? 'Thanked' : `Say thanks to ${orgName}`}
        variant="secondary"
        disabled={thanked}
        onPress={() => (signedIn ? setAsking(true) : router.push('/sign-in'))}
        style={styles.thanks}
      />
      {asking && !thanked ? (
        <Card style={styles.thanksForm}>
          <TextField
            label="A note (optional)"
            placeholder="What they did, in a sentence."
            value={note}
            onChangeText={setNote}
            maxLength={200}
            multiline
          />
          <TextField label="Sign it as" hint="A first name, or a first name and a town." value={byline} onChangeText={setByline} maxLength={60} />
          {note.trim() ? <Chip label="Show this on their page" active={show} onPress={() => setShow(!show)} /> : null}
          <Button label="Send thanks" loading={busy} disabled={busy} onPress={() => void sendThanks()} />
        </Card>
      ) : null}
      <ErrorRow message={error} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4), paddingBottom: theme.spacing(10) },
  flex: { flex: 1, minWidth: 0 },
  reportLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: theme.spacing(4) },
  reportText: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  // Edge to edge, as the board's cover runs: out past the content padding.
  cover: {
    height: 150,
    marginTop: -theme.spacing(4),
    marginHorizontal: -theme.spacing(4),
    backgroundColor: theme.colors.mintSoft,
    overflow: 'hidden',
  },
  // A centred pill, not a full-width bar.
  thanks: { alignSelf: 'center', paddingHorizontal: theme.spacing(6) },
  logo: {
    width: 76,
    height: 76,
    marginTop: -38,
    marginLeft: theme.spacing(4),
    borderRadius: theme.radii.panel,
    borderWidth: 3,
    borderColor: theme.colors.surface,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...theme.shadow(2),
  },
  logoInitial: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.primaryDeep },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    alignSelf: 'flex-start',
    marginTop: theme.spacing(3),
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.tone.mint.bg,
  },
  verifiedText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.tone.mint.fg },
  name: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.text, marginTop: theme.spacing(2) },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1) },
  thanked: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginTop: theme.spacing(3) },
  capability: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.tone.brand.fg,
    backgroundColor: theme.colors.tone.brand.bg,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
    overflow: 'hidden',
  },
  actions: { gap: theme.spacing(2), marginTop: theme.spacing(4), marginBottom: theme.spacing(4) },
  buttonRow: { flexDirection: 'row', gap: theme.spacing(2) },
  thanksForm: { gap: theme.spacing(3), padding: theme.spacing(3) },
  leads: { gap: theme.spacing(1), marginVertical: theme.spacing(4) },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.text, lineHeight: 24 },
  // One row of four, as on the board.
  stats: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(4), marginBottom: theme.spacing(6) },
  stat: { flex: 1, alignItems: 'center', padding: theme.spacing(3), borderRadius: theme.radii.field },
  // The board's stat: Baloo 2 800 20px, tabular.
  statN: { fontFamily: theme.fonts.display, fontSize: 20, fontVariant: ['tabular-nums'], color: theme.colors.text },
  statLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1) },
  section: { marginBottom: theme.spacing(6) },
  sectionTitle: { fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.text },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing(2) },
  sectionAction: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentLight,
  },
  leaderInitials: { fontFamily: theme.fonts.black, fontSize: 14, color: theme.colors.ink },
  // A section's count, muted beside its title, as the board sets it.
  count: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.muted },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1), lineHeight: 19 },
  sectionBody: { gap: theme.spacing(2), marginTop: theme.spacing(3) },
  panel: { borderRadius: theme.radii.panel, padding: theme.spacing(4), gap: theme.spacing(2) },
  panelTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  panelBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.ink, lineHeight: 21 },
  quote: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.ink, lineHeight: 21 },
  by: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  fact: { flexDirection: 'row', gap: theme.spacing(3) },
  factK: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, width: 96 },
  factV: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  door: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3), borderRadius: theme.radii.panel },
  row: { padding: theme.spacing(3), gap: theme.spacing(1), borderRadius: theme.radii.panel },
  rowTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  rowMeta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19 },
  visit: { gap: theme.spacing(2), padding: theme.spacing(3) },
})

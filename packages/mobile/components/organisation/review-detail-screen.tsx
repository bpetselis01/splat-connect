// packages/mobile/components/organisation/review-detail-screen.tsx
// One project, and what this leader may do with it. Mobile's half of web's
// app/organizations/[id]/projects/[tutorialId]/page.tsx: which actions appear
// is derived from (backing, tutorial) state via leaderActions — never from
// which route was opened.
//
// The acting organisation comes from the tutorial's own backing rows crossed
// with caps.ledOrgs, so the route needs no org param. A leader of several orgs
// with several backings on one project acts for the first pending/accepted one
// — the same single-answer posture as web, where the URL had already chosen.
//
// `admin` swaps the actor: the same brief and checklist, but the actions come
// from adminActions and land on PATCH /api/admin/tutorials/:id/status. The
// server's is_admin guard is the only check; a 403 just shows "Admins only".
//
// Title comes from the native header (app/(my)/_layout.tsx).
import { logFailure } from '../../lib/log'
import { useCallback, useRef, useState } from 'react'
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { TutorialWithDetails, TutorialOrg } from '@splat-connect/types'
import { adminActions, apiMessage, isApiError, isNetworkError, leaderActions } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'
import { reviewLead, reviewRows } from '../../lib/review-checklist'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Skeleton } from '../ui/Skeleton'
import { ListRow, ListSection, Pill } from '../list/list-kit'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'

type Detail = TutorialWithDetails

const OK = <Pill label="OK" bg={theme.colors.mintSoft} icon="checkmark" />
const FLAG = <Pill label="Flag" bg={theme.colors.honeySoft} icon="flag-outline" />

/** One section of the brief, the board's org_review row: what it holds, OK or Flag. */
function CheckRow({
  title,
  meta,
  ok,
  onPress,
  label,
}: {
  title: string
  meta: string
  ok: boolean
  onPress?: () => void
  label?: string
}) {
  return (
    <View style={styles.checkRow}>
      <ListRow title={title} meta={meta} pill={ok ? OK : FLAG} onPress={onPress} accessibilityLabel={label} />
    </View>
  )
}

export function ReviewDetailScreen({ tutorialId, admin = false }: { tutorialId: string; admin?: boolean }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [tutorial, setTutorial] = useState<Detail | null>(null)
  const [backings, setBackings] = useState<TutorialOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Same generation posture as the threads: a refetch in flight when an action
  // lands must not put the old action pair back on screen.
  const generation = useRef(0)

  const load = useCallback(async () => {
    const at = generation.current
    try {
      // Two fetches, not one: the detail route does not embed tutorial_orgs
      // (read it — LIST_SELECT does, the detail select does not), and
      // GET /:id/orgs exists precisely to answer this question. Both must
      // land before the action pair is decided, or a leader briefly sees a
      // brief with nothing to do on it.
      const [fresh, orgs] = await Promise.all([
        apiClient.get<Detail>(`/api/tutorials/${tutorialId}`),
        // An admin acts for the platform, not for a backing.
        admin ? Promise.resolve([] as TutorialOrg[]) : apiClient.get<TutorialOrg[]>(`/api/tutorials/${tutorialId}/orgs`),
      ])
      if (generation.current === at) {
        setOffline(false)
        setTutorial(fresh)
        setBackings(orgs)
      }
    } catch (err) {
      logFailure('[ReviewDetailScreen] tutorial fetch failed:', err)
      setForbidden(isApiError(err) && err.status === 403)
      setOffline(isNetworkError(err))
    } finally {
      setLoading(false)
    }
  }, [tutorialId, admin])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  const ledOrgIds = new Set((caps?.ledOrgs ?? []).map((o) => o.id))
  // The backing this leader answers for: the first of their orgs' rows that is
  // still actionable, falling back to any of theirs so the Backed state shows.
  const myRows = backings.filter((r) => ledOrgIds.has(r.org_id))
  const backing =
    myRows.find((r) => r.status === 'pending') ?? myRows.find((r) => r.status === 'accepted') ?? myRows[0] ?? null

  const actions: readonly string[] = !tutorial
    ? []
    : admin
      ? adminActions(tutorial.status)
      : leaderActions(backing?.status ?? null, tutorial.status)

  async function run(action: () => Promise<unknown>) {
    generation.current += 1
    setBusy(true)
    setError(null)
    try {
      await action()
      setNote('')
      await load()
    } catch (err) {
      setError(
        isApiError(err) && err.status === 403
          ? 'Admins only.'
          : apiMessage(err, 'Something went wrong. Please try again.')
      )
    } finally {
      setBusy(false)
    }
  }

  function requestChanges() {
    const body = note.trim()
    if (!body) {
      // The API 400s without it anyway; failing here keeps the sentence local
      // to the field it is about.
      setError('Say what needs to change — the note goes to the contributor.')
      return
    }
    void run(() => decide('rejected', body))
  }

  // Taking a live guide down: the note is the only explanation the contributor gets.
  function unpublish() {
    const body = note.trim()
    if (!body) {
      setError('Say why you are taking it down. The contributor sees this note.')
      return
    }
    void run(() => decide('rejected', body))
  }

  /** The leader's review POST, or the admin's status PATCH. */
  async function decide(status: 'approved' | 'rejected', rejection_note?: string) {
    if (!admin) {
      return apiClient.post(`/api/tutorials/${tutorialId}/review`, {
        status,
        org_id: backing!.org_id,
        ...(rejection_note ? { rejection_note } : {}),
      })
    }
    await apiClient.patch(`/api/admin/tutorials/${tutorialId}/status`, { status, rejection_note })
    // Decided, so the brief is no longer in the queue: go back to it.
    if (router.canGoBack()) router.back()
    else router.replace('/admin/review')
  }

  async function openPdf() {
    // 049 made tutorial-pdfs private: the column is a path, signed in-process
    // with the app's own session — the guides preview mechanism, reused.
    const path = tutorial?.tutorial_pdf_url
    if (!path) return
    const { data, error: signError } = await supabase.storage.from('tutorial-pdfs').createSignedUrl(path, 60)
    router.push({
      pathname: '/guides/[id]/preview',
      params: { id: tutorialId, pdfUrl: signError || !data ? '' : data.signedUrl },
    })
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width="70%" height={24} />
        <Skeleton width="100%" height={120} />
      </View>
    )
  }
  if (forbidden) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Admins only" hint="This screen belongs to admins." />
      </Screen>
    )
  }
  if (!tutorial) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title={offline ? 'You seem to be offline.' : "Couldn't load this project."}
          hint="Check your connection and try again."
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => {
              setLoading(true)
              void load()
            }}
          />
        </EmptyState>
      </Screen>
    )
  }

  const author = tutorial.tutorial_contributors?.find((tc) => tc.role === 'primary')?.profiles?.name
  const rows = reviewRows(tutorial)

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {tutorial.toy_photo_url ? <Image source={{ uri: tutorial.toy_photo_url }} style={styles.photo} /> : null}

        <Text style={styles.title}>{tutorial.title}</Text>
        <View style={styles.badgeRow}>
          <Badge status={tutorial.status} />
          <Badge status={tutorial.difficulty} />
          <Badge status={tutorial.kind} />
        </View>
        {author ? <Text style={styles.byline}>{`By ${author}`}</Text> : null}
        <Text style={styles.description}>{tutorial.description}</Text>

        <View style={styles.checks}>
          <ListSection>Check</ListSection>
          <Text style={styles.lead}>{reviewLead(rows)}</Text>
          {rows.map((r) =>
            r.title === 'Files' && tutorial.tutorial_pdf_url ? (
              <CheckRow key={r.title} title={r.title} meta={r.meta} ok={r.ok} label="Open the tutorial PDF" onPress={() => void openPdf()} />
            ) : (
              <CheckRow key={r.title} title={r.title} meta={r.meta} ok={r.ok} />
            )
          )}
        </View>

        <ErrorRow message={error} />

        {actions.includes('back') ? (
          <View style={styles.actions}>
            <Text style={styles.actionHint}>
              Backing puts {`${caps?.ledOrgs.find((o) => o.id === backing?.org_id)?.name ?? 'your organisation'}`}&apos;s
              name behind this guide, and its review in your queue when it is submitted.
            </Text>
            <View style={styles.buttonRow}>
              <Button
                label="Back this guide"
                variant="accent"
                disabled={busy}
                style={styles.rowButton}
                onPress={() => void run(() => apiClient.post(`/api/tutorials/${tutorialId}/orgs/${backing!.org_id}/accept`, {}))}
              />
              <Button
                label="Decline"
                variant="secondary"
                disabled={busy}
                style={styles.rowButton}
                onPress={() =>
                  void run(async () => {
                    await apiClient.post(`/api/tutorials/${tutorialId}/orgs/${backing!.org_id}/decline`, {})
                    // A declined project is no longer this leader's to read (the tutorial
                    // fetch 404s), so reloading would leave the old Back/Decline pair on screen.
                    if (router.canGoBack()) router.back()
                    else router.replace('/organisation')
                  })
                }
              />
            </View>
          </View>
        ) : actions.includes('approve') ? (
          <View style={styles.actions}>
            <TextField
              label="Note to the contributor"
              accessibilityLabel="Note to the contributor"
              hint="Required to request changes; ignored on approve."
              value={note}
              onChangeText={setNote}
              multiline
              style={styles.noteInput}
            />
            <View style={styles.buttonRow}>
              <Button
                label="Approve"
                variant="accent"
                disabled={busy}
                style={styles.rowButton}
                onPress={() => void run(() => decide('approved'))}
              />
              <Button
                label="Request changes"
                variant="secondary"
                disabled={busy}
                style={styles.rowButton}
                onPress={requestChanges}
              />
            </View>
          </View>
        ) : actions.includes('unpublish') ? (
          <View style={styles.actions}>
            <Text style={styles.actionHint}>
              It is live in the library now and a parent may be following it. Unpublishing removes it and shows your note to the
              contributor, who can edit and resubmit.
            </Text>
            <TextField
              label="Why are you taking it down?"
              accessibilityLabel="Why are you taking it down?"
              value={note}
              onChangeText={setNote}
              multiline
              style={styles.noteInput}
            />
            <Button label="Unpublish" variant="danger" disabled={busy} onPress={unpublish} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), gap: theme.spacing(3) },
  content: { paddingBottom: theme.spacing(8) },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.surfaceSunken,
    marginBottom: theme.spacing(3),
  },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink, lineHeight: 28 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  byline: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
    marginTop: theme.spacing(2),
  },
  // The board's lead line: the brief, muted, above the section rows.
  description: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
    marginTop: theme.spacing(3),
  },
  checks: { marginTop: theme.spacing(5) },
  lead: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, marginBottom: theme.spacing(2) },
  checkRow: { marginBottom: theme.spacing(2) },
  actions: { marginTop: theme.spacing(5) },
  actionHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
    marginBottom: theme.spacing(3),
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  rowButton: { flex: 1, borderRadius: theme.radii.pill },
})

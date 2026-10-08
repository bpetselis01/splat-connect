// packages/mobile/components/guides/model-screen.tsx
//
// One printable part, turned by hand (spec 2026-10-07 §8): a WebView running
// the generated three.js page, fed a 60-second signed URL. View only: no save,
// share or open-in-browser anywhere here; downloads live on the website.
import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isNetworkError, type StlFile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { STL_PREVIEW_MAX_BYTES, stlName, webGuideUrl } from '../../lib/guide-files'
import { STL_VIEWER_HTML } from '../../lib/stl-viewer-html'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'

type PageMessage = { type: 'ready' | 'loaded' | 'toobig' | 'error'; message?: string }
type State = 'loading' | 'shown' | 'toobig' | 'error' | 'missing'

export function ModelScreen({ id, file }: { id: string; file: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const web = useRef<WebView>(null)
  const [files, setFiles] = useState<StlFile[] | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const [state, setState] = useState<State>('loading')
  const [offline, setOffline] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [hint, setHint] = useState(true)
  const injectedUrl = useRef<string | null>(null)

  const part = files?.find((f) => f.id === file) ?? null
  const index = files && part ? files.indexOf(part) : -1

  useEffect(() => {
    apiClient.get<{ stl_files: StlFile[] }>(`/api/public/tutorials/${id}`).then((g) => setFiles(g.stl_files)).catch((err) => { setOffline(isNetworkError(err)); setState('error') })
  }, [id, attempt])

  useEffect(() => {
    if (!files) return
    if (!part) return setState('missing')
    let live = true
    supabase.storage.from('stl-files').createSignedUrl(part.file_url, 60).then(({ data, error }) => {
      if (!live) return
      if (error || !data) setState('error')
      else setUrl(data.signedUrl)
    }).catch(() => { if (live) setState('error') })
    return () => { live = false }
  }, [files, part, attempt])

  // Load once both the page and the URL are in: whichever lands second fires it.
  useEffect(() => {
    if (!pageReady || !url || injectedUrl.current === url || state === 'error' || state === 'toobig') return
    injectedUrl.current = url
    web.current?.injectJavaScript(`window.__load(${JSON.stringify(url)}, ${STL_PREVIEW_MAX_BYTES}); true;`)
  }, [pageReady, url, state])

  useEffect(() => { const t = setTimeout(() => setHint(false), 3000); return () => clearTimeout(t) }, [])

  function onMessage(e: { nativeEvent: { data: string } }) {
    let m: PageMessage
    try { m = JSON.parse(e.nativeEvent.data) } catch { return }
    if (m.type === 'ready') setPageReady(true)
    else if (m.type === 'loaded') setState('shown')
    else if (m.type === 'toobig') setState('toobig')
    else if (m.type === 'error') setState('error')
  }

  function retry() {
    setState('loading'); setOffline(false); setUrl(null); setFiles(null); setPageReady(false); injectedUrl.current = null; setAttempt((n) => n + 1)
  }

  const title = part ? `${stlName(part.filename)} · ${part.filename}` : '3D view'
  const chips = part ? [part.print_minutes ? `${part.print_minutes} min print` : '', part.filament_grams ? `${part.filament_grams} g${part.material ? ` ${part.material}` : ''}` : '', files ? `${index + 1} of ${files.length}` : ''].filter(Boolean) : []
  const webLink = webGuideUrl(id)

  return (
    <View style={styles.page}>
      <View style={[styles.head, { paddingTop: insets.top + theme.spacing(2) }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close 3D view" hitSlop={6} style={styles.round}>
          <Ionicons name="close" size={20} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.headText} numberOfLines={1} accessibilityRole="header">{title}</Text>
        <View style={styles.roundSpace} />
      </View>

      <View style={styles.body}>
        {state === 'missing' ? (
          <EmptyState icon="cube-outline" title="This part is no longer on the guide." />
        ) : state === 'error' ? (
          <View style={styles.center}>
            <EmptyState icon="cloud-offline-outline" title={offline ? 'You seem to be offline.' : "Couldn't load this part."} />
            <Button label="Try again" variant="secondary" onPress={retry} />
          </View>
        ) : state === 'toobig' ? (
          <View style={styles.center}>
            <EmptyState icon="cube-outline" title="This part is too big to preview on a phone." />
            {webLink ? (
              <Text accessibilityRole="link" onPress={() => void Linking.openURL(webLink)} style={styles.link}>Download on the web</Text>
            ) : null}
          </View>
        ) : (
          <>
            {!files ? <Skeleton width="100%" height={200} /> : null}
            <WebView
              ref={web}
              source={{ html: STL_VIEWER_HTML }}
              originWhitelist={['*']}
              javaScriptEnabled
              allowFileAccess={false}
              onMessage={onMessage}
              style={styles.web}
            />
            {hint ? <Text style={styles.hint} pointerEvents="none">Drag to turn · pinch to zoom</Text> : null}
            <View style={styles.chips} pointerEvents="none">
              {chips.map((c) => <View key={c} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>)}
            </View>
          </>
        )}
      </View>

      {files?.length ? (
        <View style={[styles.foot, { paddingBottom: insets.bottom + theme.spacing(3) }]}>
          <Button label="Ask someone to print" onPress={() => {
            // This screen is a fullScreenModal: a screen pushed from it opens
            // underneath on iOS and never shows. Close it, then push.
            router.back()
            router.push({ pathname: '/printing', params: { guide: id } })
          }} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.surfaceSunken },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(2), backgroundColor: theme.colors.background },
  round: { width: 44, height: 44, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  roundSpace: { width: 44, height: 44 },
  headText: { flex: 1, fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink, textAlign: 'center' },
  body: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(4) },
  hint: { position: 'absolute', top: theme.spacing(3), left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  chips: { position: 'absolute', left: theme.spacing(4), right: theme.spacing(4), bottom: theme.spacing(3), flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: theme.spacing(2) },
  chip: { paddingHorizontal: theme.spacing(3), paddingVertical: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface, ...theme.shadow(1) },
  chipText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  link: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  foot: { paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
})

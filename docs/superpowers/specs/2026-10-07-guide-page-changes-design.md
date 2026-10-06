# Guide page changes (mobile) — design

Date: 2026-10-07. Mockups: https://claude.ai/artifact/5EReg7MHpQejTfeXjXbEsh (every row's option A, with Byron's three notes applied).
Builds on docs/superpowers/specs/2026-10-06-guide-screens-redesign-design.md. Mobile only; the web guide page keeps its tabs, notes and downloads.

## Decisions

| Question | Decision |
|---|---|
| What you'll need rows | Option A: one row per destination, each with a pill naming the tab it opens. Rows carry only the count ("4 parts", "4 tools", "2 parts to 3D print"); no sublines. |
| Tab names | Overview · **Supplies** · Files · **Feedback**. Feedback shows its total count as an apricot badge. |
| Feedback tab layout | Option A, the review list: composer bar, filter chips, Fix cards, one-line note rows, actions behind ⋯. |
| Files tab | Option A: one "Guide files" card (PDF + each STL), web link as the card's footer, Ask someone to print as the one filled button, print settings last. |
| File downloads on the phone | None. PDF opens in the in-app viewer; its footer links to the guide's web page. STLs open in a 3D viewer. |
| 3D viewer | three.js inside the existing `react-native-webview`, bundled locally, loaded on tap. No native module. |
| End of build | "Leave feedback" opens the feedback sheet in build mode; posting turns it into a confirmation; "See it on the guide" closes build mode onto the guide already underneath, on Feedback, with the new note scrolled into view and highlighted. |
| Badge count | Total feedback on the guide. "New since last visit" is not built. |
| "Whole guide" feedback | Not built. Feedback stays per step or Missing step, as the data is today. |

## 1. Guide page: What you'll need

`components/home/detail-screen.tsx`. The card stops being one Pressable. It becomes a title plus up to three rows, each its own Pressable (`accessibilityRole="button"`):

| Row | Shown when | Label | Pill | Tap |
|---|---|---|---|---|
| Parts | `parts.length` | `4 parts` | `Supplies ⌄` | `openTab('parts')` |
| Tools | `tools.length` | `4 tools` | `Supplies ⌄` | `openTab('parts')` |
| Print | `stl_files.length` | `2 parts to 3D print` | `Files ⌄` | `openTab('files', { highlight: 'print' })` |

The print row sits on `accentFaint` with an apricot icon well so it reads as different from the gather rows. The pill is `accentLight` ground, `primaryDeep` text, with `chevron-down`. The card hides entirely when all three counts are zero.

`openTab` gains an optional `highlight`. After the tab switches and the scroll lands, the Files tab's print card shows a `primary` ring for 1.6 s (an `Animated` opacity on a border overlay; `prefers-reduced-motion` has no RN equivalent, so the ring simply fades). The gathered counts (`0/4`) leave the card; they still show on the Supplies tab's meter and rows.

## 2. Tabs

`Segmented` options become `Overview`, `Supplies`, `Files`, `Feedback`. The `Tab` union keeps its internal values (`parts`, `notes`) so deep links (`?tab=notes`, used by build mode and e2e) keep working; only labels change. `Segmented` gains an optional `badge?: number` per option: a 17 px apricot pill with ink text, placed after the label, shown when > 0. The Feedback option passes `notes.length`.

## 3. Feedback tab

`components/guides/community-notes.tsx` is rewritten around a list, with the composer pulled out into its own sheet.

**Layout, top to bottom**
1. Composer bar: the viewer's initials avatar, "Share a fix or a tip…", camera icon. Tapping anywhere opens `FeedbackSheet`. Signed out: the bar reads "Sign in to leave feedback" and routes to sign-in.
2. Filter chips (`Chip`): `All N`, `Fixes N` (only when any pinned), then `Step N` for each step that has feedback, then `Missing` when any. Single-select; `All` default. Filtering is local.
3. Fix cards: every pinned note, on `honeySoft`, headed `pin` icon + "Fix · approved by {first name}", body prefixed by its step label in bold, then "{author} · {relative time}". ⋯ at top right.
4. Note rows: avatar initials, `author · time`, step tag pill (`Step 4` on accentLight; `Missing step` likewise), body, optional 64 px photo thumbnail at the right that opens `PhotoViewer`. ⋯ at top right of the row.
5. Empty: "No feedback yet. Built it? Say how it went." under the composer bar.

**⋯ menu** — a bottom sheet (`Modal`, slide, the pattern in `components/home/add-shortcut-sheet.tsx`) titled "{author}'s note on {step label}", listing only what this viewer can do:
- "Pin as a fix" / "Unpin" when `canPin`
- "Report this note" when not the author
- "Delete" (danger) when the author
- Cancel

Pin, unpin and delete call the same endpoints as today and `reload()`; results go to the existing `FlashLine`.

**Report targets the note.** Today `ReportProblem` is called with `subjectKind="guide"` and the guide's id, so a report about a note is filed against the guide. Fix: `REPORT_SUBJECT_KINDS` gains `'note'`; migration `132_report_note_kind.sql` widens `member_reports_subject_kind_check` the way 118 did (guarded, DOWN noted); the API's report route accepts it unchanged (it validates against the shared constant); the menu files `{ subjectKind: 'note', subjectId: note.id, subjectLabel: "{author}'s note on {guide title}" }`. The admin queue on web lists the kind by its string, so it needs no change beyond the shared constant; `report-problem.tsx`'s `REASONS_FOR` gets a `note` entry (same reasons as `guide`).

## 4. FeedbackSheet

New `components/guides/feedback-sheet.tsx`. A `Modal` bottom sheet holding what the inline form held: the step chips (`Step 1…N`, `Missing step`), the body field (1000 max), add-a-photo / caption, Post. Props:

```ts
type Props = {
  tutorialId: string
  steps: TutorialStep[]
  authorFirstName: string          // "Mei can pin it as a fix so the next builder sees it."
  initialStep?: number | null      // preselects a chip; undefined = none chosen
  open: boolean
  onClose: () => void
  onPosted: (note: GuideNote) => void   // the 201 body
}
```

Title "How did it go?". The POST is the existing `/api/tutorials/:id/notes`; the 201 body is the note, which `onPosted` receives. Errors use `ErrorRow` inside the sheet; the sheet stays open on failure.

After a successful post the sheet's content swaps to a confirmation (same Modal, no second popup): green tick, "Feedback posted", "It's on the guide's Feedback tab now, under {step label}.", primary "See it on the guide", ghost "Stay here". What the two buttons do depends on where the sheet was opened:
- From the Feedback tab: both close the sheet; `DetailScreen` reloads notes and passes the new note's id as `highlightId` so it scrolls into view and rings (see §6).
- From build mode: "See it on the guide" calls `onSeeOnGuide(note)` (an extra optional prop); "Stay here" just closes.

## 5. Build mode: Leave feedback

`components/guides/build-mode.tsx`. On the done screen the secondary button reads **Leave feedback** and opens `FeedbackSheet` with `initialStep` = the last step whose body the person viewed (the `at` value before reaching the done screen; stored in a ref). `toNotes` (the `router.replace` to a second copy of the guide) is removed.

"See it on the guide" must land on the guide page already mounted beneath build mode, not a second copy. Mechanism: a small module store `lib/guide-focus.ts`:

```ts
export type GuideFocus = { tutorialId: string; noteId: string }
export function setGuideFocus(f: GuideFocus): void
export function takeGuideFocus(tutorialId: string): GuideFocus | null  // returns and clears
```

Build mode calls `setGuideFocus({ tutorialId, noteId })` then `router.back()`. `DetailScreen`'s existing `useFocusEffect` calls `takeGuideFocus(id)`; when it gets one it `reload()`s notes, sets `tab` to `notes`, and hands the note id to `CommunityNotes` as `highlightId`. The web-side in-page links (`guides-notes.spec.ts` deep links with `?tab=notes`) are untouched.

## 6. Highlighting a note

`CommunityNotes` takes `highlightId?: string`. When the list renders a row with that id it measures the row's `y` via `onLayout`, the screen scrolls so the row sits just under the sticky tabs (`scroller.scrollTo({ y: tabsY + rowY })`), and the row shows an `accentFaint` fill and `primary` ring that fades over 2 s. A `Toast` "Your feedback is on the guide" shows at the same time. The highlight clears itself after the fade so a later reload does not repeat it. Scrolling needs the row's offset relative to the ScrollView content: `CommunityNotes` reports `onHighlightLayout(y)` and `DetailScreen` adds its own section offset.

## 7. Files tab

Replaces the three sections with:

1. **Guide files card** (`Section`-less card): a row per file.
   - PDF row: doc icon, "Full guide", "PDF · read on screen", pill **View** → `openPreview()` (unchanged signing).
   - STL rows: cube icon, a friendly name (filename without extension, underscores to spaces, first letter capitalised), subline `{print_minutes} min · {filament_grams} g` when present, pill **3D** → `/guides/[id]/model?file={stl id}`.
   - Footer (sunken ground, hairline above): globe icon, "Printing it yourself? **Download the files on the web**", external-link icon. Opens `${EXPO_PUBLIC_WEB_URL}/tutorials/${id}` via `Linking`. Styled as a real row: 12 px vertical padding, caption size, `primaryDeep` bold for the link phrase, the whole footer pressable with `accessibilityRole="link"`.
   - Card hidden when there is no PDF and no STL; the tab then shows "Nothing to download for this guide." as today.
2. **Ask someone to print** card: unchanged behaviour, restyled as the one filled (`primary`) card, white text; only when `stl_files.length`. This is the `highlight: 'print'` target.
3. **Print settings** card: unchanged content, moved last.

**PDF viewer** (`components/guides/preview-screen.tsx`): header title "Full guide"; the footer button becomes "Download on the web" with globe + external icons, opening the guide's web page. `Open in browser` (which handed over the signed file) is removed. The bottom action bar's "Download PDF" (guides with no steps) becomes "View full guide".

## 8. 3D viewer

New route `app/(tabs)/guides/[id]/model.tsx` → `components/guides/model-screen.tsx`.

- Header: ✕ (closes the screen), title "{friendly name} · {filename}".
- Body: a `WebView` with `source={{ html: STL_VIEWER_HTML }}`. `STL_VIEWER_HTML` is a string export in `lib/stl-viewer-html.ts`, generated and committed by `scripts/build-stl-viewer.mjs` from `assets/stl-viewer/index.html` (the page's own markup, CSS and JS) with three.js r128 (`three.min.js`, `STLLoader.js`, `OrbitControls.js`) inlined from the pinned npm package. About 600 KB, in the JS bundle, no asset loading, no new dependency (`react-native-webview` is already installed), no native module, so no iOS prebuild. `originWhitelist={['*']}`, `allowFileAccess` off, `javaScriptEnabled`. A unit test asserts the generated module matches a fresh build so the two cannot drift.
- Loading the file: the screen signs the STL path with `supabase.storage.from('stl-files').createSignedUrl(path, 60)` (the bucket is private since 049, same as the PDF) and posts `{ url }` into the page with `injectJavaScript`. The page fetches it, parses with `STLLoader`, centres and fits the mesh to the camera, `MeshStandardMaterial` in `primary`, hemisphere + key light, `OrbitControls` with damping, no pan, auto-rotate until first touch. Files over 25 MB (from `Content-Length`) are refused in the page with a message; the screen then shows an `EmptyState` "This part is too big to preview on a phone" with the web link.
- Overlays (RN, over the WebView): hint "Drag to turn · pinch to zoom" for 3 s, chips `{print_minutes} min print`, `{filament_grams} g {material}`, `{i} of {n}`; footer "Ask someone to print" (primary) when the guide has STLs.
- Errors: the page posts `{ error }` back via `window.ReactNativeWebView.postMessage`; the screen shows `EmptyState` "Couldn't load this part." with Retry.
- No save, share or open-in-browser control anywhere on the screen.

If the WebView cannot fetch the signed URL cross-origin (Supabase storage sends `Access-Control-Allow-Origin: *`, so it should), fall back to the screen fetching the bytes and posting them base64-encoded. The plan's first task proves which path works on the device before the rest is built.

## 9. Data flow summary

- Notes: `GET /api/public/tutorials/:id/notes` (unchanged) → `useGuideNotes` → `CommunityNotes` list + `Segmented` badge + What you'll need (none).
- Post: `FeedbackSheet` → `POST /api/tutorials/:id/notes` → 201 note → `onPosted` → (build mode) `setGuideFocus` + `router.back()` → `DetailScreen.useFocusEffect` → `takeGuideFocus` → reload, tab, highlight.
- Report a note: `ReportProblem` with `subjectKind: 'note'` → `POST /api/reports` → `member_reports` (132 widens the check).
- STL: `stl_files.file_url` → signed URL (60 s) → WebView fetch → three.js.

## 10. Tests

Mobile unit (`tests/unit`, jest):
- `components/home/detail-screen`: need rows render by counts, each tap sets the right tab, print row only with STLs, badge shows `notes.length`, tab labels.
- `components/ui/Segmented`: badge renders when > 0, hidden at 0.
- `components/guides/community-notes`: filters (All/Fixes/Step/Missing), fix cards vs rows, ⋯ menu items by viewer (author / canPin / other), report subject is `note` + note id, highlight row gets the ring and calls `onHighlightLayout`.
- `components/guides/feedback-sheet`: Post disabled until step + body, POST body shape, 201 → confirmation, failure stays open with the message, `initialStep` preselects, `onSeeOnGuide` only from build mode.
- `components/guides/build-mode`: done screen button reads Leave feedback and opens the sheet with the last viewed step; See it on the guide calls `setGuideFocus` then `router.back()`; no `router.replace`.
- `lib/guide-focus`: set/take round trip, take clears, wrong id returns null.
- `components/guides/model-screen`: signs the path, injects the URL, error message → EmptyState, oversize → EmptyState with web link, no share/save controls.
- `components/guides/preview-screen`: footer opens `${WEB_URL}/tutorials/:id`, no "Open in browser".
- `lib/theme` guards (type scale, raw colours) keep passing.

API:
- Unit: `REPORT_SUBJECT_KINDS` includes `note`; the reports route accepts `subject_kind: 'note'` and rejects an unknown kind.
- Integration: a report with `subject_kind: 'note'` inserts (132 applied); `POST /api/tutorials/:id/notes` 201 body carries `id`, `step_position`, `author_name` (the fields the sheet and highlight rely on).

Mobile e2e (Playwright, `tests/e2e`, importing only from `lib/`):
- `guides-detail.spec.ts`: What you'll need rows switch tabs; print row lands on Files with the print card visible; tab labels Supplies/Feedback; badge count.
- `guides-notes.spec.ts` → `guides-feedback.spec.ts`: composer bar opens the sheet; post → confirmation → list shows the note highlighted; filter chips; ⋯ menu shows Delete for own note and Report for another's; report posts `subject_kind: note`.
- `guides-build-mode.spec.ts`: finish all steps → Leave feedback → post → See it on the guide → the same guide page (history length unchanged), Feedback tab, note in view.
- `guides-pdf.spec.ts`: button reads View, viewer footer reads Download on the web and links to the web guide; no Open in browser.
- `guides-files.spec.ts` (new): Guide files card rows, 3D pill opens the model route, web footer link href; the model screen on react-native-web renders the WebView shell and overlays (three.js itself is not asserted on web).

**Interacting components.** Every existing component, hook, route or helper a new piece calls or is called by gets tests for the interaction, not just the new piece in isolation. Each is listed with what its test proves:

| Existing piece | Interacts with | Test proves |
|---|---|---|
| `ui/Segmented` | tabs + badge | badge prop renders/hides; label changes keep `accessibilityState.selected`; snapshot across all four variants unchanged where no badge |
| `ui/Chip` | filter chips, step chips in the sheet | active state toggles; single-select behaviour in both hosts |
| `ui/Toast` + `useToast` | highlight toast | "Your feedback is on the guide" shows once and auto-hides; not re-shown on a later reload |
| `ui/PhotoViewer` | note thumbnails | tapping a thumb opens the viewer at that photo with its caption |
| `ui/EmptyState`, `ui/ErrorRow`, `ui/Flash` | sheet, model screen, menu results | the exact copy and states listed in §3, §4, §8 render through them |
| `ui/Button`, `ui/TextField` | sheet | disabled/loading states drive Post; maxLength 1000 / caption 60 |
| `reports/report-problem` | ⋯ menu | opens with `subjectKind: 'note'`, `REASONS_FOR.note` reasons, posts `subject_id = note.id` |
| `lib/guide-notes` (`useGuideNotes`, `noteSummary`, `stepLabel`) | filter chips, fix cards, badge, overview "fixes from builders" card | chip counts equal `noteSummary` counts; `reload()` after post/pin/delete refreshes the badge and the overview card |
| `lib/guide-progress` (`useDeviceTicks`, `stepProgress`) | build mode done screen, last-viewed step | finishing the last step still ticks it and the guide's Start building reads Build it again after `router.back()` |
| `lib/guide-focus` (new) ↔ `DetailScreen.useFocusEffect` | build mode → guide | focus is consumed once; a second focus of the guide does not re-highlight |
| `expo-router` `router.back()` | ✕ on the model screen and build mode | the model screen is a `fullScreenModal` with its own ✕ that returns to the guide's Files tab (one `router.back()`), the same shape as build mode's ✕; a feedback sheet open at the moment build mode closes is dismissed first |
| `lib/upload` (`pickAndUploadPhoto`) | sheet add-a-photo | upload path `/api/upload/note-photo` and the returned `path` lands in the POST body |
| `lib/supabase` storage signing | PDF + STL | `createSignedUrl` called with the right bucket and 60 s; a signing error shows the error state, never a blank viewer |
| `lib/api-client` | sheet POST, menu actions | 4xx bodies surface through `apiMessage`; a 401 on post routes to sign-in |
| `home/detail-screen` (overview) | need rows, badge, fixes card, `openTab` highlight | `openTab` scroll target and highlight flag; "Read the fix" link still opens Feedback |
| `guides/build-mode` | sheet, `guide-focus`, step notes link | "N notes on this step in the guide's Feedback" link copy updated and still deep-links to the tab |
| `guides/preview-screen` | web link | footer `Linking.openURL` with `${EXPO_PUBLIC_WEB_URL}/tutorials/:id`; empty-PDF state unchanged |
| API `routes/tutorial-notes` | sheet | 201 body shape; 400 on empty body; 401 signed out; photo_path accepted |
| API `routes/reports` | ⋯ menu | `note` accepted, unknown kind 400; integration: row inserts under 132 |
| API `routes/public` notes | list, badge | ordering (pinned first, then newest) matches what the chips/fix cards assume |
| Web `admin` reports queue | kind `note` | a `note` report lists with its label and does not crash the kind switch |
| `types` `REPORT_SUBJECT_KINDS` | all of the above | the drift test between the constant and migration 132's check |

Existing specs that assert the old copy (`Notes`, `You'll need`, `Download PDF`, `Open in browser`, `Leave a note`, `Community notes`) are updated in the same task that changes the copy, never left red.

On device (Maestro `guide-page.yaml`): extend with tapping a 3D pill and asserting the viewer screen title and the "Ask someone to print" footer; the Hermes layer is where WebView + asset loading is proven.

Parity (`scripts/parity`): re-run web parity after the shared `Segmented` change.

## 11. Out of scope

- "New since last visit" badge logic.
- "Whole guide" feedback kind.
- Web guide page changes (its Notes tab, downloads and tabs stay).
- Print or Share from the PDF viewer (still skipped, as in the 2026-10-06 spec).
- Native (expo-gl) rendering of STLs.

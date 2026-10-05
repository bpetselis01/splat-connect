# Map tab (mobile) — design

Mockup: https://claude.ai/artifact/Q2GMV7emYY35QYtrW8LWtb (v4, approved 2026-10-05).
Closes `map-tab` in `packages/types/src/pending.ts`.

## What it is

The Map tab shows toys, printers, events, drop-offs and organisations near the
viewer as pins, one pin per suburb with a count. Tapping a pin opens a bottom
sheet listing what is there. Layer chips hide or show a kind. A Filters button
right of the search bar opens a sheet (distance, filament, event dates). One
button bottom-right, above the tab bar, flips between Map and List. The list
shows the same places, nearest first, grouped by distance.

## Decisions

- **Free stack.** `@maplibre/maplibre-react-native` draws the map, with
  OpenFreeMap tiles (no key, no cap). Only `components/map/MapCanvas.tsx`
  imports MapLibre. Swapping to Google later means rewriting that one file
  with `react-native-maps`.
- **No geocoding API.** A place is a suburb. Its point is the mean of the ABS
  postcode centres (`postcode_centroids`, 099) of the rows in that suburb,
  rounded to 3 decimal places, the same rule `impact_map()` (121) uses. A
  street address is never read.
- **Family toys are pinned at their owner's suburb** (Byron, 2026-10-05). This
  makes a family's suburb public, which the app did not do before.
- **One endpoint.** `GET /api/public/map?near=<postcode>` returns places
  already grouped. Map, sheet and list all read that one array.
- **Filters run on the phone** over that array. No extra query parameters.
- **Dropped from the mockup:** "Toys ready to give". A published toy is
  available; no field says otherwise.

## Layers and their sources

| Kind | Rows | Suburb, state, postcode from | Taps through to |
|---|---|---|---|
| toy | `toys` status `published`, not at capacity | owner's `pickup_suburb/state/postcode` (profile or organisation) | `/toy-library/:id` |
| printer | `printers` where `accepting` | the printer's `suburb/state/postcode` | `/printing` |
| event | `org_events` in person, not cancelled, not over | the event's `suburb/state`; point from other rows in that suburb, else the host organisation's `pickup_postcode` | `/news/event/:id` |
| dropoff | organisations with any `recycling_materials` | organisation `suburb/state` + `pickup_postcode` | `/explore/recycling` |
| org | organisations not suspended | organisation `suburb/state` + `pickup_postcode` | `/toy-library/organisation/:id` |

A row with no suburb, or whose suburb has no point, is left off the map.

## API shape

```ts
type MapKind = 'toy' | 'printer' | 'event' | 'dropoff' | 'org'
interface MapItem { kind: MapKind; id: string; title: string; meta: string | null;
  materials?: string[]; starts_at?: string }
interface MapPlace { suburb: string; state: string; lat: number; lng: number;
  km: number | null; items: MapItem[] }
```

`km` is the haversine distance from the viewer's postcode centre, whole km,
null without `near`. Places are sorted nearest first when `near` is set.

The grouping is a pure function in `packages/api/src/map.ts`, tested on its
own. The route in `public.ts` only loads rows and calls it.

## Mobile

- `app/(tabs)/map.tsx` renders `components/map/map-screen.tsx`.
- `components/map/MapCanvas.tsx` (MapLibre) and `MapCanvas.web.tsx` (a plain
  "the map needs the app" note, so react-native-web, e2e and parity still build).
- `lib/map-filters.ts`: a pure `applyFilters(places, { kinds, within, materials, when })`.
- The list reuses `ListRow` and `ListSection`. The viewer's postcode comes from
  `useCapabilities()` → `profile.pickup_postcode`, through `nearParam`, as the
  printer finder does.
- MapLibre is native: the iOS dev client needs `expo prebuild` and a rebuild.

## Testing

- API: unit test for the grouping (suburb merge, point mean, km, rows with no point dropped).
- Mobile: unit tests for `applyFilters`, and for the screen with `MapCanvas`
  mocked (chips, filters sheet, List/Map button, sheet on pin select, empty
  state, load failure).
- On the phone after the rebuild: the map draws, pins appear, a tap opens the sheet.

# Map pins at real addresses — design

Follows `2026-10-05-map-tab-design.md`. Approved in chat 2026-10-05.

## Problem

Every pin sat at its postcode centre, then fanned out up to ~300 m, so an
organisation could show a kilometre or more from its building.

## Decisions (Byron, 2026-10-05)

- **Organisation addresses are public.** An organisation, its drop-off, its
  toys and its printers pin at the organisation's pickup address, and the card
  shows the street line.
- **Individuals pin at their suburb's centre**, never a street: family toys and
  personal printers. Family items stay signed-in only (d69ec9ea).
- **In-person events pin at their venue** (`location`, suburb, state).
- **Geocoder: OpenStreetMap Nominatim.** Free, no key. One file
  (`packages/api/src/geocode.ts`) knows it; Google later is a one-file swap.

## Approach: geocode on read, cached

The map endpoint already gathers every address. Each one becomes a query
string; `geocodes` (migration 126) caches the answer by that string. Only a
miss calls Nominatim. No write path changes: an address edited anywhere (web,
mobile, admin, SQL) is new text, so it misses the cache and is looked up.

| Item | Query |
|---|---|
| organisation-located | `line1, suburb STATE postcode, Australia` |
| event | `location, suburb STATE, Australia` (no suburb: just `location, Australia`) |
| individual | `suburb STATE postcode, Australia` |

- `geocodes(query text primary key, lat, lng, found boolean, geocoded_at)`.
  RLS on, no policies: service role only. Not-found answers are cached too.
- Nominatim policy: at most one request a second (a process-wide queue), a
  User-Agent naming the app and a contact, `countrycodes=au`, `limit=1`.
- The endpoint waits up to 3 s for new lookups; the rest finish in the
  background and are cached for the next load.
- A failed or not-found lookup falls back to the postcode centre (099), so an
  item is never dropped for a geocoding miss.

## Grouping

A place is now a point (address or suburb centre), keyed by the rounded
coordinates, labelled with its suburb. `MapPlace` gains `address: string | null`
(the street line for organisation-located places, null for suburb centres).
Several items at one point fan out ~20 m, and clustering runs to zoom 17, so
they separate where they really are.

## Out of scope

The Map and address section on an organisation's own page (`org-visit-map`).

## Testing

- Unit: query building, grouping by point, fallback to postcode centre.
- Integration (Nominatim stubbed): miss → lookup → cached; hit → no lookup;
  not found → postcode centre; changed address → new lookup.
- On the phone: pins at the addresses, cards show the street line.

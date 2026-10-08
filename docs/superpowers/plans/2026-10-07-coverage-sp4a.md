# Coverage SP4a: organisation leader journeys (e2e)

Every spec drives the leader's UI against the real API and local Supabase, asserts the visible result and the DB row, and the counterpart's view where the journey notifies. Fixtures live in `tests/e2e/org-fixtures.ts` only where `helpers.ts` has nothing.

- [ ] org-publish.spec.ts: L19 L20 L21 L22 L30 (event/story create, publish toggle with follower notification, remove, news redirect)
- [ ] org-profile-edit.spec.ts: L23 (Save and publish, public page shows it)
- [ ] org-leaders.spec.ts: L25 L26 L27 (invite, cancel, step down)
- [ ] org-messages.spec.ts: L28 (list; reply both sides, L29 tagged too)
- [ ] org-recycling.spec.ts: L14 L15 (Contaminated, Save what you take; weigh and credit L13 as the booking-to-credit chain)
- [ ] org-requests.spec.ts: L17 (row opens thread by type)
- [ ] org-review.spec.ts: L03 L05 (open the PDF, Decline)
- [ ] org-inventory.spec.ts: L09 L10 (Remove retired toy, empty CTA)

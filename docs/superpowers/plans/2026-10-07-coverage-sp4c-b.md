# Coverage audit SP4c half two: family toys, exchanges, challenges, orgs, events (e2e)

Spec: `docs/superpowers/specs/2026-10-07-mobile-coverage-audit-design.md` §4 SP4c. Each spec provisions its own data, drives the web build, asserts the visible result and the DB row. New helpers live only in `tests/e2e/family-toys-fixtures.ts`.

- [ ] `family-toys-fixtures.ts`: partyPage, reportThroughSheet, notificationsOf, seedOrgWithPublicPage, seedPrintDecline
- [ ] `toy-editor.spec.ts` closes W05 W06 W07 W08 W10 W11
- [ ] `exchange-actions.spec.ts` closes X05 X08 X09 X13 X14
- [ ] `challenges-actions.spec.ts` closes C04 C06 C07 C08 C09 C13
- [ ] `org-public-actions.spec.ts` closes P02 P03 P05 P06 P07 P09 Y09
- [ ] `toy-detail-actions.spec.ts` closes Y07 Y08
- [ ] `events-and-recycling.spec.ts` closes V01 V02 V03 V06

Each is run through the e2e wrapper before its commit. Bugs found are fixed in their own commit with a regression test; new-feature gaps go to the report.

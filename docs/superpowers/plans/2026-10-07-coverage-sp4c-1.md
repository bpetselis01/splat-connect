# SP4c half one: family e2e (guides, authoring, discovery, account)

Each spec provisions its own data and asserts the visible result and the DB row. Helpers live in `tests/e2e/family-fixtures.ts`.

- [ ] `guides-authoring-sections.spec.ts`: T02 T07 T11 T16 T17 T19 T21
- [ ] `guides-new-and-reader.spec.ts`: G07 N02 N05 B04 B07
- [ ] `showcase.spec.ts`: S02 S03
- [ ] `me-and-explore.spec.ts`: Q03 Q04 Q08 Q09 Q16 Q11 Q12
- [ ] `account-fields.spec.ts`: A12 Z02 Z08 Z10

Skipped when the journey cannot be seen in the web build: B04 device layer, anything the inventory marks device-only.

/**
 * Organisation-level facts shared by /about and /contact.
 *
 * REPLACE BEFORE LAUNCH. tests/unit/app/about.test.tsx guards `legalName` and
 * `basedIn` — both still start with "TODO" and the corresponding guard tests
 * are `it.todo` until real values are supplied. Do not invent them.
 */
export const ORG_FACTS = {
  legalName: 'TODO: registered name of the organisation',
  basedIn: 'TODO: city, state',
  founded: 'TODO: year',
  contactEmail: 'TODO: hello@example.org',
}

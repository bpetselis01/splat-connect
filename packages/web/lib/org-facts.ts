/**
 * Organisation-level facts shared by /about and /contact.
 *
 * PENDING(org-facts): REPLACE BEFORE LAUNCH. tests/unit/app/about.test.tsx guards `legalName` and
 * `basedIn` — both are still null (the contact page shows To be completed) and the
 * corresponding guard tests are `it.todo` until real values are supplied. Do not invent them.
 */
export const ORG_FACTS: {
  legalName: string | null
  basedIn: string | null
  founded: string | null
  contactEmail: string | null
} = {
  legalName: null,
  basedIn: null,
  founded: null,
  contactEmail: null,
}

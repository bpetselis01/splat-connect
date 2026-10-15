// Every unfinished feature in SPLAT Connect, measured against the Claude
// Design board — docs/superpowers/specs/2026-09-30-pending-work-registry-design.md.
// Code refers to an item as `PENDING(<id>)` in a comment or `pending="<id>"`
// on a pending control; docs/PENDING.md is generated from this file
// (`node scripts/pending.mjs`); packages/api/tests/unit/pending-features.test.ts
// fails when the three drift. Finishing an item: do the work at each
// reference, delete them, set `shipped: true` (or delete the entry), regenerate.
//
// Erasable TypeScript only (no enums): scripts/pending.mjs imports this file
// with plain `node`.
type PendingKind = 'setup' | 'content' | 'build' | 'decision'
type PendingPlatform = 'web' | 'mobile' | 'api'
export type PendingItem = {
  title: string
  blurb: string
  kind: PendingKind
  platforms: PendingPlatform[]
  board?: string
  needs: string
  question?: string
  shipped?: boolean
}

export const PENDING = {
  'apple-sign-in': {
    title: "Sign in with Apple",
    blurb: "Apple sign-in isn't switched on yet. Use your email for now — you can link Apple later.",
    kind: "setup",
    platforms: ["mobile"],
    needs: "Paid Apple team, capability, Supabase provider, env, rebuild",
  },
  'google-sign-in': {
    title: "Continue with Google",
    blurb: "Google sign-in isn't switched on yet. Use your email for now — the same address will link to Google later.",
    kind: "setup",
    platforms: ["mobile"],
    needs: "Google OAuth clients + brand verification, Supabase provider, env, rebuild",
  },
  'apple-revoke': {
    title: "Removing Apple access on deletion",
    blurb: "Deleting an account signed in with Apple also removes SPLAT from your Apple ID once this is switched on.",
    kind: "setup",
    platforms: ["api", "mobile"],
    needs: "Sign in with Apple key on the API",
  },
  'email-delivery': {
    title: "Emails to every member",
    blurb: "Codes and confirmations only reach the SPLAT team until custom email is switched on.",
    kind: "setup",
    platforms: ["api"],
    needs: "Resend domain, Supabase custom SMTP, API env, Apple relay",
  },
  'site-url': {
    title: "Links in emails",
    blurb: "Links in SPLAT emails point at the wrong address until the site URL is set.",
    kind: "setup",
    platforms: ["api"],
    needs: "Hosted Supabase Site URL is http://localhost:3000",
  },
  'org-visit-map': {
    title: "Map and address",
    blurb: "An organisation's map and street address will appear here. Message them to arrange a visit for now.",
    kind: "setup",
    platforms: ["mobile", "web"],
    needs: "Organisation page map + street address (the public profile and the app show To be completed); a maps provider, and a call on when to show the address",
  },
  'contributor-terms-legal': {
    title: "Contributor terms",
    blurb: "The final contributor terms are being reviewed by a lawyer.",
    kind: "content",
    platforms: ["web", "mobile"],
    needs: "Lawyer-reviewed terms (board has draft copy); the terms screens show To be completed until then",
  },
  'org-leader-terms-legal': {
    title: "Organisation leader terms",
    blurb: "The final organisation leader terms are being reviewed by a lawyer.",
    kind: "content",
    platforms: ["web"],
    needs: "Lawyer-reviewed terms; the page shows To be completed until then",
  },
  'intended-purpose-review': {
    title: "Intended purpose",
    blurb: "This statement is waiting on a legal review.",
    kind: "content",
    platforms: ["web"],
    needs: "Legal review of /legal/intended-purpose; the page carries a To be completed notice until then",
  },
  'terms-version': {
    title: "Terms version",
    blurb: "Accepted terms carry a working version number until the final text is published.",
    kind: "content",
    platforms: ["web", "mobile", "api"],
    needs: "AGREEMENT_VERSIONS still v0-todo; set at the same time as the lawyer-reviewed terms (acceptances at v0-todo are void)",
  },
  'team-page': {
    title: "Our team",
    blurb: "Who runs SPLAT Connect will appear on this page.",
    kind: "content",
    platforms: ["web", "mobile"],
    needs: "Names, roles, bios in TEAM_MEMBERS (/about/team shows To be completed while it is empty; the app opens that page)",
  },
  'org-facts': {
    title: "About the organisation",
    blurb: "SPLAT's registered details will appear here.",
    kind: "content",
    platforms: ["web"],
    needs: "Legal name, based in, founded, contact email in lib/org-facts.ts (null today; /contact shows To be completed)",
  },
  'learn-article-hero': {
    title: "Article pictures",
    blurb: "Pictures for Learn articles will appear here.",
    kind: "content",
    platforms: ["mobile"],
    needs: "Hero image per Learn article (each article shows To be completed until then)",
  },
  'printing-basics-hero': {
    title: "Printing basics picture",
    blurb: "A picture for Printing basics will appear here.",
    kind: "content",
    platforms: ["mobile"],
    needs: "Printing basics hero photo (the screen shows To be completed until then)",
  },
  'admin-guide-review-screen': {
    title: "Reviewing a guide on the phone",
    blurb: "When no organisation backs a guide, admins get a \"guide submitted\" notification. Tapping it opens a screen telling them it belongs to organisation leaders; the approve or request-changes decision is only on the website.",
    kind: "decision",
    platforms: ["mobile"],
    needs: "A phone review screen for admins (about the size of the organisation review screen, which it can reuse) plus its tests. The API route already exists.",
    question: "Build an admin guide-review screen on the phone (a new screen plus tests, reusing the organisation review screen), or change the notification to say \"review on the website\" and link there (a small copy change)?",
    shipped: true,
  },
  'profile-thanks-hide': {
    title: "Hiding a thank-you note",
    blurb: "People can thank a contributor with a note and it shows on their profile, but the person cannot hide a note: no screen lists them.",
    kind: "decision",
    platforms: ["mobile","web"],
    needs: "A \"Notes people sent you\" list with Hide and Show: one small screen on the phone, optionally the web. GET/PATCH /contributors/me/thanks already exist.",
    question: "Build the Hide and Show list (one small screen per platform, routes already built), or delete the two routes (small, but it drops hiding for good)?",
  },
  'multi-org-leader-switch': {
    title: "Leading more than one organisation",
    blurb: "A person who leads two or more organisations silently acts for the first one on every leader screen. Nothing shows a choice.",
    kind: "decision",
    platforms: ["mobile"],
    needs: "An organisation picker plus passing the chosen organisation through about six leader screens.",
    question: "Add an organisation picker (about six screens touched), or leave it until someone actually leads two organisations (nobody in the test data does)?",
  },
  'event-registration-mobile': {
    title: "Registering for events on the phone",
    blurb: "My events and Can't make it work on the phone, but the I'm going button, the organiser's questions and the leader's list of who registered exist only on the website.",
    kind: "decision",
    platforms: ["mobile"],
    needs: "A register screen with dynamic questions and capacity messages, and a registrations list for leaders: the largest of the open choices.",
    question: "Build event registration and the leader registrations list on the phone (two screens, the biggest cost here), or keep both on the website and point the phone there?",
  },
  'unused-api-routes': {
    title: "Routes nothing uses",
    blurb: "Seven API routes have tests but no screen calls them: report an idea participant, list and resolve admin reports, reinstate a removed idea participant, read and hide profile thanks, a reporter's own reports, the old singular unread count, and print-at-event. A person who reports something never hears the outcome.",
    kind: "decision",
    platforms: ["api"],
    needs: "Per route, a screen that calls it or deletion with its tests. Telling a reporter their report was resolved also needs a new notification type and the web admin screen to send it.",
    question: "For each of the seven routes: wire it to a screen (a screen each) or delete it and its tests (small, but it removes the only hint of the intended feature)? Should a reporter be told when their report is resolved (new notification type plus web admin screen)?",
  },
  'backing-notifications': {
    title: "Telling a family about backing",
    blurb: "When an organisation accepts or declines backing a family's guide, the family is not told.",
    kind: "decision",
    platforms: ["api","mobile"],
    needs: "A new notification type (migration), sent from the accept and decline routes, plus its copy on web and mobile. Found by the notification-chains work.",
    question: "Add accepted and declined backing notifications (migration, API, copy on web and mobile), or leave families to find out on the guide page?",
  },
  'generated-stl-sizes': {
    title: "Sizes that make themselves",
    blurb: "Choosing a size on a print request will produce the right STL automatically, so a printer no longer has to adjust the design by hand.",
    kind: "build",
    platforms: ["api", "mobile", "web"],
    needs: "Follows contributor-defined customization fields (docs/superpowers/specs/2026-10-09-contributor-customization-fields-design.md). A contributor attaches a parametric OpenSCAD file whose parameters map to their fields (the optional `param` on each field); on request the API renders the STL in a sandbox with a time limit, checks the bounding box against the printer's bed, and shows the printer a preview. Small/Medium/Large are parameter-set presets.",
  },
} satisfies Record<string, PendingItem>

export type PendingId = keyof typeof PENDING
export const isPendingId = (x: string): x is PendingId => Object.hasOwn(PENDING, x)

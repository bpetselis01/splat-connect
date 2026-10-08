# Coverage audit SP2: notification chains

Spec: docs/superpowers/specs/2026-10-07-mobile-coverage-audit-design.md (section 4, SP2). Gap rows: K12 (toy_withdrawn); S16 list; S1 S2 S4 S18.

## Product fixes (one commit each, with regression test)
- [ ] S1 leader review (POST /tutorials/:id/review) notifies every contributor, via one shared helper that admin.ts also uses (API test; closes the T/leader review chain)
- [ ] S2 threadHref and notification links send print jobs to /printing/jobs/:id (mobile unit test; builds.ts, notifications.ts linkFor, My exchanges, Me money line)
- [ ] S4 org_thanked links to the org profile editor with Hide/Show (mobile unit test)
- [ ] S18 collaborator_invited links to where the invitee can accept (mobile unit test)

## API integration: a row assertion (recipient, type, link target) per notifying journey
- [ ] toy-transactions: toy_request (Y05 Y06 K05 R03), toy_accepted (W03 X04 K02 K04 K06 R13), toy_rejected (X05 X07 K07 R14), toy_withdrawn (X06 K12 R06), toy_message (X03 K13 R05 R10), build_shot_posted K08, build_approved K09, print_started R07, print_ready R08
- [ ] ideas: challenge_joined C03, challenge_left + challenge_removed C04, idea_approved + idea_rejected C12
- [ ] tutorials: backing_requested T18, tutorial_submitted T05 T22
- [ ] org/contributor/collab rows re-checked: org_message L29 P10, org_event/story L19 L20 L21, org_thanked P04 Y07, profile_thanked S02 X13 R11 Y07, tutorial_thanked G09, tutorial_noted G23 B04, collaborator_accepted/declined Q08 Q09

## Mobile unit
- [ ] table-driven linkFor + copyFor over every NotificationType

## e2e (tests/e2e/notifications-chains.spec.ts)
- [ ] family -> leader, leader -> guide author, printer -> requester

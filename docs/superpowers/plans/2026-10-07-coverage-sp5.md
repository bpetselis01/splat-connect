# Coverage audit SP5: web-only hand-offs, unit gaps, waivers

- [ ] Auth against local Supabase and Mailpit (sign-up code, password sign-in, sign-in code, resend, recovery, sign-out): A04 A05 A06 A07 A08 A09 A10 A12 Z04
- [ ] Signed URLs against local storage: G16 L03
- [ ] Mobile read endpoints: Q07 Q10 H01 V09 G30 L26
- [ ] Web hand-off: event registered on web shows in /events/mine: V01
- [ ] Unit: L26 cancel invitation, Z10 web dashboard and privacy links, P02 unfollow
- [ ] Waivers in journeys.json (A03 and any layer nothing can test) and docs/testing/mobile-journeys-decisions.md

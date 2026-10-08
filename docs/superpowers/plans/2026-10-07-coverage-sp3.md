# Coverage SP3: live counts

App fixes (one commit each, each with a unit test that fails without it)
- [ ] S7 admin seat guard (Q17)
- [ ] S19 Me retry when /contributors/me fails (Q01)
- [ ] S6 Me + tab badges refetch on focus
- [ ] S6 toy editor "N offers" refetch on focus (W12)
- [ ] invalidateCapabilities after accept/decline/withdraw/confirm/send/post (W03, L29, P10, R07, R08, R10, X10-X12)
- [ ] server-derived thanks counts (P04, L24, library thanks pill)

E2E specs (one per cluster; each mutates in the UI, asserts the number without reload, asserts the DB row)
- [ ] counts-inbox-badges: W03 Q10 L16 L31 L29 P10
- [ ] counts-toy-offers: W12 W04 W09
- [ ] counts-thanks: P04 L24 C11 G25
- [ ] counts-money: X10 X11 X12
- [ ] counts-printing: R07 R08 R10 R15 R16 L11
- [ ] counts-recycling: V04 V05 L12 L13
- [ ] counts-org-publish: L18 Q17
- [ ] counts-account: Z01 Z03

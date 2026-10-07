# Coverage SP4b: maker and printer journeys (e2e)

Closes K03 K04 K06 K07 K08 K09 K10 K11 K12 K13 R05 R09 R11 R13 R14 (also R07 R08 R10, which the same specs exercise).
Fixtures live in `tests/e2e/maker-fixtures.ts`; each spec provisions its own rows.

- [ ] maker-fixtures.ts (seed print job, seed build, notification reader, party page)
- [ ] `print-job-printer.spec.ts`: R13 accept, R07 started, R08 ready (photo), R05 message, R09 printer confirm, R10 fit, R11 thanks
- [ ] `print-decline.spec.ts`: R14 decline with reason, requester sees it
- [ ] `build-ask-first.spec.ts`: K03 question both ways, K04 claim from ask-first
- [ ] `build-thread.spec.ts`: K06 take it on, K08 working shot, K10 ask for change, K09 approve, K13 message, K11 handover
- [ ] `build-decline-withdraw.spec.ts`: K07 decline, K12 withdraw

# Coverage audit SP6: device flows (Maestro)

Gap list: B04, G27, Z04 (the other `device` journeys already have a tagged flow).

- [ ] Fix `sign-out-clears-session.yaml` (S15): Me tab > Account row > Sign Out; assert signed out, relaunch, assert still signed out. Closes Z04.
- [ ] Seed a second member's note on the device guide (`provision-device-parent.mjs`), plus ids on extra output lines.
- [ ] `feedback-sheet-post.yaml`: build mode done screen > Leave feedback (modal over modal) > post > confirmation > See it on the guide. Closes B04.
- [ ] `note-report.yaml`: Feedback tab > note menu > Report this note (iOS second-modal path) > send. Adds a `testID` to the report text field. Closes G27.
- [ ] `inbox-badge-live.yaml`: seed a notification mid-flow, badge updates. Extends H07.
- [ ] `deep-link-cold-start.yaml`: cold start via `splatconnect://` into a pushed guide screen. Extends A05, A14.
- [ ] Run on the iOS simulator under JDK 17 and report each result.

> Research notes for U11 of docs/plans/journey-coverage-plan.md, 2026-10-20. Durations are estimates, not benchmarks; the first manual run replaces them.

# Maestro Android CI research (2026-10-20)

Repo read: maestro-android.yml is workflow_dispatch-only, API 34 x86_64 pixel_6, Java 17, KVM udev step, Maestro via get.maestro.mobile.dev, `--format junit --output`, continue-on-error. Composite actions: setup (pnpm 11, node 22, pnpm cache), supabase-start (CLI 2.109.1).

## Q1 android-emulator-runner
Source: https://github.com/ReactiveCircus/android-emulator-runner (README, fetched)
- README still says to enable KVM before the action on ubuntu-latest, with the exact udev rule already in the repo workflow (kvm4all.rules + udevadm reload/trigger). It recommends ubuntu-latest over macOS.
- Snapshot caching recipe: actions/cache@v5 on `~/.android/avd/*` and `~/.android/adb*`. Step 1 (cache miss only): run the action with `force-avd-creation: false`, `emulator-options` WITHOUT `-no-snapshot` (so a clean snapshot is generated), trivial script (`echo "Generated AVD snapshot"`). Step 2 (always): run with `force-avd-creation: false` and `emulator-options` containing `-no-snapshot-save`. force-avd-creation defaults true. The cache key should include api-level/arch/target.
- Setting emulator-options REPLACES defaults (default: `-no-window -gpu swiftshader_indirect -no-snapshot -noaudio -no-boot-anim`), so keep -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim in both steps.
- API 34/35: README lists no breakage; api-level accepts 35-ext15, Baklava; system-image-api-level for ext images. Not found: any issue tracker evidence (did not search issues). Google docs say snapshots are unreliable with software rendering (swiftshader) (https://developer.android.com/studio/run/emulator-snapshots) - worth a smoke test.

## Q2 Durations (WEAK SOURCING: searches found no dated benchmarks)
Searches (Expo blog, Tenki, Infinite Red) gave only: Infinite Red CI had Android native build ~19 min vs iOS ~9 (https://shift.infinite.red/cut-ci-from-20-minutes-to-6-with-eas-workflows-and-eas-updates-8d928fe5dcfc, EAS-hosted, not free runner); EAS Gradle cache ~50% faster (https://expo.dev/changelog/gradle-cache.md); Tenki says first cold emulator boot takes "a few minutes", warm AVD dramatically faster (https://tenki.cloud/docs/runners/android-emulator).
My unsourced estimates for a 4-core/16GB public ubuntu-latest (the repo's comment says 2-core; public-repo runners are 4-core, private are 2-core - verify): 
- (a) prebuild + assembleRelease: cold 15-30 min (private 2-core: up to 35+); warm gradle cache 6-12 min. Single-ABI (-PreactNativeArchitectures=x86_64) cuts a lot.
- (b) emulator boot: cold create+boot 3-6 min (includes system-image download); from snapshot 30-90 s.
- (c) Maestro install ~30-60 s; 13 short flows ~8-20 min on a software-GPU emulator (Maestro driver start + app launch overhead per flow).
Total PR-check estimate: ~15-25 min warm, 30-50 min cold. MEASURE with a first manual run.

## Q3 Maestro CI
- Install: curl script is still the documented install for Linux (https://docs.maestro.dev/getting-started/installing-maestro/linux, https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli); pin with `MAESTRO_VERSION=x.y.z` env before the script. Official docs: Java 17 or higher required. DeepWiki lists 17/21 (unofficial). Keep Java 17 (current workflow) - safe.
- maestro-cloud is hosted devices (Expo integration: https://expo.dev/blog/expo-now-supports-maestro-cloud-testing-in-your-ci-workflow); not needed for local emulator.
- Flags (https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options.md): `--format=JUNIT|HTML|NOOP`, `--output=<file>`, `--shard-split=N`, `--shard-all=N` (N connected devices), `--test-output-dir`, `--env`. No documented fail-fast flag on that page; Maestro runs all flows in a directory and exits non-zero if any fail. To fail fast, loop flows in shell with `set -e` instead (loses single JUnit file). Note --shard-* need N devices, not useful on one emulator.

## Q4 Cache scoping  (CHANGES THE PLAN)
Source: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching (fetched)
- Runs can restore caches from the current branch, the default branch, and (for PRs) the PR base branch. Not from child/sibling branches. Caches are shared across workflows in the same repo+branch scope.
- A pull_request run saves into refs/pull/N/merge scope, restorable only by re-runs of that PR.
- Therefore: a workflow_dispatch maestro-cache.yml works ONLY if it runs on the default branch (main) - then every PR can restore it. If dispatched on `development` it is visible only to PRs whose BASE is development (this repo's PRs target development, so it would work for those, but not for PRs into main). Dispatched on any feature branch: invisible to PRs. Cross-workflow sharing itself is fine. Note workflow_dispatch workflow files must exist on the default branch to be dispatchable from the UI (general GH behaviour, not in fetched page). Also repo cache cap 10 GB with LRU eviction; AVD + gradle may crowd it - consider a weekly schedule on the base branch to keep it fresh (caches unused 7 days are evicted).

## Q5 Skipped required checks (CHANGES THE PLAN)
Sources: https://docs.github.com/en/actions/using-jobs/using-conditions-to-control-job-execution : "A job that is skipped will report its status as 'Success'. It will not prevent a pull request from merging, even if it is a required check." ; troubleshooting required status checks page (fetched): a whole WORKFLOW skipped via paths/branches filter or commit message leaves its checks "Pending" and BLOCKS merging.
- So gate with job-level `if:` (passes) not workflow-level `paths:` (blocks). Caveat: if a job `needs` a skipped job, it is also skipped (success). Matrix jobs skipped by if report under the unexpanded job name - require the plain job name.

# Mobile App Market Research: UI Inspiration

**Prepared:** 2026-10-01  
**Scope:** SPLAT Connect's Expo mobile app; adjacent products and services for accessible play, assistive technology, child-specific support, and caregiver guidance.

## Executive Take

There is no exact one-to-one comparator in this set: SPLAT combines adapted-toy discovery, practical build guides, family-to-family exchanges, child-fit context, and a contributor/community layer. The most useful inspiration is therefore compositional: borrow discovery and request patterns from Makers Making Change, child-specific caregiver controls from Goally, activity personalization from Kinedu, and multimodal visual supports from Choiceworks. FairPlay is a service-model reference for access to adapted toys, not a mobile-app competitor.

The clearest opportunity is to make the path from **"this may suit my child"** to **"I can get or make it"** feel continuous and well-explained. SPLAT already has the building blocks: child-fit guide filtering, toy availability and access filters, guide-to-toy links, and exchange threads.

## SPLAT's Current Mobile Shape

- Four primary tabs: **Guides, Toys, Inbox, Me**. Explore is reached from Me rather than taking a fifth tab.
- Guides supports toy-name search, guide type, difficulty, build time, printable files, sorting, saves, and a "Suits your child" filter.
- The toy library supports availability, switch-adapted, condition, newest, and distance filtering; toy details connect related build guides and start a gift/swap request.
- Inbox groups exchange threads, notifications, and tutorial collaboration invites.
- The child profile is an optional, skippable, step-by-step setup. It collects practical access context such as age, hand use, switch force, aiming, hold, and everyday needs.
- Explore links to learning, design challenges, maker-wanted requests, recycling, organisations, and other community content.
- Beyond the four tabs, the route tree includes sign-in/account and organisation/admin areas, saved content, tutorial contribution/collaboration, toy exchanges and messages, notifications, printing/print requests, challenges, events, and news.

This is a route-and-key-flow survey of the current mobile app, not a claim that every route has equal depth or polish. Some menu destinations are intentionally marked as not built yet.

Local references: [tab navigation](../../packages/mobile/components/tab-bar.tsx), [guide discovery](../../packages/mobile/components/home/library-screen.tsx), [toy discovery](../../packages/mobile/components/toys/toy-library-screen.tsx), [toy detail and request](../../packages/mobile/components/toys/toy-detail-screen.tsx), [inbox](../../packages/mobile/components/inbox/inbox-screen.tsx), [child profile](../../packages/mobile/components/profile/child-wizard.tsx), [Me hub](../../packages/mobile/app/(tabs)/me.tsx).

## Benchmarks

### 1. Makers Making Change: device library and maker matching

[Assistive Devices Library](https://www.makersmakingchange.com/assistive-devices) · [Request workflow](https://www.makersmakingchange.com/how-it-works/request-a-device) · [Maker Wanted](https://www.makersmakingchange.com/maker-wanted) · [Example adapted toy](https://www.makersmakingchange.com/product/switch-adapted-ms.-rachel-speak-%26-sing-doll/01tJR000009fBNJYA2)

**Why it is relevant:** The closest functional analogue. Its public library covers assistive devices and adapted toys; users can either build from open instructions or request a volunteer maker. The request flow sets expectations around matching, chat, costs, customisation, delivery, and review.

**UI patterns worth studying:**
- Filter by meaningful need/category, not only product title. The library exposes device type and disability-related filters.
- Put the decision-critical facts on the item page: what it does, how it is activated, who it may suit, estimated cost, skills/tools, assembly time, instructions, and license.
- Make the next step explicit: build it yourself or request a maker. Keep request progress and conversation attached to the item.
- Use real photos of the adapted object and its access points, not only a generic catalogue thumbnail.

**SPLAT translation:** Make each toy and guide legible as a practical choice: access method, compatibility/fit, condition or parts, time/skill, and availability. Keep the existing toy-to-guide connection, then make the next action and exchange state obvious. Avoid copying MMC's exact vocabulary or assuming that a single adaptation suits every person.

### 2. FairPlay: toy access and lending-library service model

[FairPlay](https://www.fairplaylibraries.org/aboutfp) · [Family Play Access Program](https://www.fairplaylibraries.org/family-play-access-program) · [Toy library application](https://www.fairplaylibraries.org/requestalibrary)

**Why it is relevant:** FairPlay adapts toys and supplies adaptive toy libraries to facilities; it also runs a family program that provides age-appropriate toys and switches. This is a strong analogue for the access problem behind SPLAT's toy library and request flows, but it is not itself a software-app comparator.

**UI patterns worth studying:**
- Separate pathways by audience and intent: family access, facility library, and learning to adapt toys are different jobs.
- State eligibility, selection timing, expected notification dates, and shipping up front. Users should not have to infer whether a request is immediate or grant/cycle-based.
- Keep forms manageable. The current library application warns that it cannot be saved mid-way; for a sensitive or lengthy mobile flow, save-and-resume would be a useful improvement over that constraint.

**SPLAT translation:** Distinguish borrowing, gifting, swapping, and learning to build before a user commits. Show availability and any timing or handoff expectations beside the action. Do not imply that SPLAT has FairPlay's grant or lending model unless that is actually supported.

### 3. Goally: caregiver-managed child routines

[Goally app overview](https://getgoally.com/) · [Apps for autism](https://getgoally.com/apps-for-kids-with-special-needs/autism/) · [iOS Parent App listing](https://apps.apple.com/us/app/goally/id1262461227)

**Why it is relevant:** The Parent App manages routines, reminders, and checklists for a child's Goally tablet. Goally describes child-specific visual schedules, photo-based steps, rewards, and a separate caregiver experience.

**UI patterns worth studying:**
- Make child context visible when showing tailored content; do not leave caregivers guessing which profile is active.
- Keep setup and editing tools on the caregiver side, while keeping the child's task view direct and uncluttered.
- Use a small number of clear, ordered steps with concrete visual cues for routines.

**SPLAT translation:** Make "Suits [child]" discoverable and explain why an item matched the profile. Preserve a fast way to switch child context and edit or skip profile details. This is inspiration for caregiver information architecture, not a reason to turn SPLAT into a gamified routine tracker.

**Caveat:** Goally is tied to its own child device and life-skills product ecosystem; it is adjacent rather than a direct competitor to an open library and exchange platform.

### 4. Kinedu: personalized activity discovery

[Kinedu](https://kinedu.com/) · [App Store listing](https://apps.apple.com/us/app/kinedu-baby-development/id741277284)

**Why it is relevant:** Kinedu presents a daily activity plan based on a child's age and developmental stage, alongside expert guidance, milestones, progress reports, and support for multiple children.

**UI patterns worth studying:**
- Translate a large content library into a useful "what can I do today?" starting point.
- Explain recommendations through visible context (for SPLAT, the stated access need, age range, time, or available materials).
- Support more than one child without forcing users to repeat the entire account journey.

**SPLAT translation:** Consider a compact, optional "good matches for [child]" or "quick builds" entry point that leads into the full library. Keep the full browse experience available and let caregivers understand or change the match criteria.

**Caveat:** Kinedu is aimed at early-childhood development and is not a specialist adapted-play service. Do not import developmental scoring, milestones, or assumptions about disability into SPLAT without a clear clinical and product basis.

### 5. Choiceworks: customizable, multimodal visual supports

[Choiceworks on the App Store](https://apps.apple.com/us/app/choiceworks/id486210964)

**Why it is relevant:** Choiceworks uses visual boards for schedules, waiting, and feelings. Its App Store listing describes custom photos, video, text, recorded audio, multiple profiles, VoiceOver support, and boards that can be shared/exported.

**UI patterns worth studying:**
- Let people use familiar, personally meaningful media where generic icons are not enough.
- Give each step a clear purpose and keep progress understandable.
- Treat assistive access, larger text, and screen-reader support as part of the core workflow, not a settings-page afterthought.

**SPLAT translation:** For tutorials, investigate step-level photos/video and clear materials/tools/time summaries; for profile and guide content, test whether labels make sense with VoiceOver and larger text. Choiceworks is intentionally local and standalone, whereas SPLAT needs shared content and transactions, so its storage model is not a direct fit.

## Cross-Market Opportunities for SPLAT

1. **Bring fit into the item card.** On Guides and Toys, show the most decision-relevant fit/access facts before opening detail. Preserve the current filters, and add a concise explanation for a child-fit match rather than a mysterious recommendation badge.
2. **Make the next action unambiguous.** From a toy or guide, label the available route (read/build, gift, swap, or contact/request) and carry the item context into the resulting thread. Show what happens next and who needs to act.
3. **Use practical metadata as the visual hierarchy.** Access method, compatibility, build time, skill/tools, condition, availability, and location are more valuable than decorative badges. Reserve dense details for the detail screen, but surface the top two or three on the list row.
4. **Support both family and maker jobs without mixing them.** Keep caregiver discovery and request paths easy to scan; keep contribution, organisation, and moderation actions grouped in Me/Explore or role-aware views.
5. **Keep personalisation consensual and reversible.** The child profile can improve matches, but browsing should remain useful without completing it. State what profile answers affect, make skip/edit easy, and avoid turning support needs into diagnostic labels.
6. **Treat content as something used with hands busy.** Tutorial steps should be glanceable, with clear sequence, tool/part references, legible media, and accessible controls. Consider whether audio or short video would materially help a step before adding media everywhere.
7. **Close the trust loop.** Borrow/request status, message history, handoff details, and feedback should stay attached to the toy or guide that prompted the interaction. Use plain language for cost, availability, and responsibility.

## Suggested Inspiration Review

When exploring visual references, compare these concrete screens/workflows rather than whole-brand styling:

- MMC: device library filters → adapted-toy detail → create request → maker conversation.
- Goally: parent chooses a child → edits a routine → child sees one actionable step.
- Kinedu: personalized daily activity → activity detail → progress/context.
- Choiceworks: schedule board with custom media → completed/next state.
- FairPlay: family application and library pathway, especially how timing and eligibility are explained.

For SPLAT, review the existing **Guide list/detail**, **Toy list/detail/request**, **child profile**, and **Inbox** side by side. The aim should be a coherent route from discovery to useful action, not a visual reskin of any one benchmark.

## Sources and Limits

Research was conducted on 2026-10-01 using first-party product/program pages and Apple App Store listings linked above. Product capabilities are summarized from those sources; promotional metrics and unverified user-review claims are not treated as evidence. This is a desk-research synthesis, not hands-on usability testing or a full competitor audit. The benchmark set intentionally mixes direct access-service analogues with adjacent apps, and the distinctions are called out above.

# How Khan Academy, Udemy and Brilliant structure learning content (web and mobile, many authors)

Researched 2026-10-02 for SPLAT Connect's Learn. Sources are each product's own help centre or creator docs unless marked **[secondary]**. Help-centre pages on support.khanacademy.org and support.udemy.com return HTTP 403 to direct fetches, so claims about them come from search-engine extracts of those pages, not a full read. Anything marked **[unverified]** could not be confirmed from a primary source.

## SPLAT Connect today (what this is compared against)

- **Web** (`packages/web/lib/learn-course.ts`): one course with 6 units and 16 lessons. Each lesson has `kind: 'read' | 'build' | 'quiz'`, and each is a hand-written page under `packages/web/app/learn/<slug>/page.tsx`. Build steps and quiz questions are in `lib/learn-content.json`. Progress is kept in `localStorage` (`lib/learn-progress.ts`), so it stays on one device and does not follow a sign-in. `/learn/ask-an-expert` sits outside the course.
- **Mobile** (`packages/mobile/lib/learn-content.ts`, `components/explore/learn-hub.tsx`): six flat articles shipped inside the app. They have no units or checkpoints. The first three are shown as "start here" and the rest as "deeper". The file says it is transcribed by hand from the web pages and drifts when the web changes. One mobile article, `printing-basics`, has no matching `/learn` page on web.
- **Planned, not shipped** (Task 18, `site-content-learn-legal-editing`, in `docs/superpowers/plans/2026-10-01-people-orgs-me-build.md`; `packages/types/src/learn-course.ts` does not exist yet). The outline moves into one `site_content` row (key `learn-course`). Admins can rename, re-time, re-kind and reorder units, but cannot add anything, because lessons stay pages in code. The row also stores a course title, an outcome and "Shown as": **Free**, **Free, sign-in needed** or **Hidden**. Hidden replaces every `/learn` page, and the mobile Learn screen, with "Course hidden". Mobile treats sign-in-needed as Free.
- **Who can edit:** `profiles.role` is either `admin` or `contributor` (001). `site_content` has `updated_by` and `updated_at` (065) but no draft state or history, and saves are last-write-wins.
- **SPLAT already has a multi-author pipeline, but for Guides, not Learn.** `tutorials.status` is one of `draft`, `pending`, `approved` or `rejected` (001_schema.sql:21-22), and only `approved` is publicly readable (001:138).

---

## 1. Khan Academy

**Hierarchy.** Course → Unit → Lesson → content item. "Courses consist of units and the Course Challenge, units comprised of lessons and quizzes, and lessons comprised of a mix of articles, videos and practice exercises" ([What are Course and Unit Mastery?](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery)). The types teachers can assign are article, video, exercise, quiz, unit test and course challenge ([What types of content can I assign](https://support.khanacademy.org/hc/en-us/articles/18564282990861-What-types-of-content-can-I-assign-to-my-students)). Progress is measured per skill: Not started, Attempted, Familiar, Proficient, Mastered. Course Mastery % is the share of skills at Proficient or above. Only some courses have Mastery turned on ([Which courses have mastery enabled](https://support.khanacademy.org/hc/en-us/articles/360014675332-Which-courses-have-mastery-enabled)).

**Discovery.**
- **Explore menu:** domains such as Math and Computing, each listing its courses.
- **Learner Home** is the first page after login. It shows classes, "My courses" (up to 9 the learner picks), streaks and levels.
- **"Resume Learning"** returns the learner to their latest courses and units.
- **Search.**
- Some courses are deliberately left out of the Explore menu. They can still be reached through search, My courses, domain pages and Resume Learning ([Finding courses not in Explore](https://support.khanacademy.org/hc/en-us/articles/360045835432-How-can-I-find-courses-that-aren-t-listed-in-the-Explore-menu); [Learner Home](https://support.khanacademy.org/hc/en-us/articles/360030629852-What-is-my-Learner-Home-page-and-what-can-I-do-there); [Edit My Courses](https://support.khanacademy.org/hc/en-us/articles/115003342971-How-do-I-edit-the-My-Courses-section-on-my-Home-page)).

**Authoring model.**
- Content is made in-house by "content specialists" and outside subject-matter partners, such as NASA and the American Museum of Natural History.
- "Content creators act as editorial experts by reviewing the work of other content creators."
- All published articles, exercises and videos get human review before learners see them ([Content development and AI](https://support.khanacademy.org/hc/en-us/articles/20349258135181-How-does-Khan-Academy-use-AI-in-our-content-development-process); [Content Principles](https://support.khanacademy.org/hc/en-us/articles/360054562832-What-are-Khan-Academy-s-Content-Principles)).
- Teachers and learners cannot publish courses. Teachers only assign existing content.
- **[unverified]:** the internal CMS states (draft, review, publish), course versioning, and how a retired course is handled. Khan does not document these publicly.
- **Visibility:** everything is free. Login is needed only to save progress. "Not listed in Explore" is a real but unnamed third state between listed and gone.

**Mobile vs web.**
- The app has a bottom nav labelled Home, Search, Bookmarks and Profile **[secondary: [BridgingApps](https://search.bridgingapps.org/apps/khan-academy)]**.
- Offline: videos can be downloaded through Bookmarks. Fully disconnected sites are pointed to Kolibri ([Using KA without internet](https://support.khanacademy.org/hc/en-us/articles/202487370-How-can-I-use-Khan-Academy-without-an-internet-connection)).
- The app omits computer-programming talkthroughs and projects, which are web only ([community answer on KA support](https://support.khanacademy.org/hc/en-us/community/posts/360000677711-Adding-Computer-Programming-to-App-on-mobile-Platforms-ie-Android); [official app FAQ](https://support.khanacademy.org/hc/en-us/articles/202487540-Does-Khan-Academy-have-an-official-mobile-app)).

**Coherence across many authors.**
- There is one publisher, and every author is staff or a vetted partner.
- Creators peer-review each other.
- A shared skill model (mastery levels) keeps content consistent.
- There is a single fixed hierarchy.
- The Explore menu is curated, and courses can be dropped from it without deleting them.

## 2. Udemy

**Hierarchy.** Course → Section → curriculum item. Item types are lecture (video, slides, text, resources), quiz, coding exercise, practice test and assignment. A course can hold up to 1,400 items, with 800 published at once and at most 2 practice tests ([Add sections and lectures](https://support.udemy.com/hc/en-us/articles/229605768-How-to-add-sections-lectures-and-video-content-to-your-course); [Practice tests](https://support.udemy.com/hc/en-us/articles/1500006547442-How-to-create-practice-tests-or-practice-test-courses)). Items are published individually, so a course always has a mix of published and unpublished items.

**Discovery.**
- **Marketplace browsing:** category → subcategory → topic.
- **Topics:** the instructor picks a primary topic and up to 4 topics before review. Topics drive recommendations, topic pages and badges, and cannot be changed after publishing ([Topics](https://support.udemy.com/hc/en-us/articles/115000371028-Primary-Topics-Quickly-Provide-Key-Information-About-Your-Course); [Basic info](https://support.udemy.com/hc/en-us/articles/360060625813-How-to-Enter-The-Basic-Info-For-a-Course)).
- **Free preview lectures:** at least 10 minutes, always including the first video ([Free Lecture Preview](https://support.udemy.com/hc/en-us/articles/229604168-Free-Lecture-Preview)).
- **"My learning":** continue an enrolled course ([Udemy Business mobile player](https://business-support.udemy.com/hc/en-us/sections/4419761831831-Mobile-course-player)).

**Authoring model (an open marketplace).**
- Anyone can become an instructor.
- Course states:
  - **Draft:** the checklist on the left must be complete before submitting.
  - **Submit for Review:** the Quality Review team replies in about 2 business days.
  - **Published:** discoverable.
  - **Unpublished:** hidden from the marketplace with no new enrolments, but enrolled students keep access.
  - **Deleted:** only possible with no enrolments **[unverified detail]**.
  ([Submit for review](https://support.udemy.com/hc/en-us/articles/229604268-Submit-a-Course-for-Review); [Quality Review Process](https://support.udemy.com/hc/en-us/articles/229605348-Udemy-s-Quality-Review-Process); [Quality checklist](https://support.udemy.com/hc/en-us/articles/229604988-Udemy-course-quality-checklist); [Delete/Unpublish/Republish](https://support.udemy.com/hc/en-us/articles/229604968-Instructors-How-to-Delete-Unpublish-or-Republish-Your-Course))
- **Privacy, separate from status:** Public, Private (Invitation Only) or Private (Password Protected). A private course is not discoverable, and the link has to be shared ([Private enrolment page](https://support.udemy.com/hc/en-us/articles/229604188-How-to-Make-a-Course-Enrollment-Page-Private)).
- **Roles per course:** co-instructors and teaching assistants are invited by email. Permissions can be granted separately, for example **Visible** (listed publicly as an instructor) and **Manage** (edit content, settings, permissions and coupons) ([Co-instructors and permissions](https://support.udemy.com/hc/en-us/articles/229604308-Instructors-How-to-Add-Co-instructors-And-Teaching-Assistants-And-Manage-Course-Permissions); [Co-instructor rules](https://support.udemy.com/hc/en-us/articles/229605728-Co-Instructor-Relationships-Rules-and-Guidelines)).
- **Versioning:** none for learners. Lecture edits go live immediately, and completion % is recalculated ([Course maintenance](https://teach.udemy.com/publishing/maintain-your-course/); [Updating a lecture](https://support.udemy.com/hc/en-us/articles/229604908-Updating-Content-for-an-Existing-Lecture)). Instructors may not unpublish chunks of content to shrink a course, because of the lifetime-access promise ([Lifetime access](https://support.udemy.com/hc/en-us/articles/229603708-Lifetime-access)).
- **Free vs paid:** free courses must have under 2 hours of video and come without a certificate, Q&A or messaging ([Free courses](https://support.udemy.com/hc/en-us/articles/1500010482202-Free-Courses-What-Should-Instructors-Know)).

**Mobile vs web.**
- The apps download lectures for offline viewing. Downloads are encrypted and play only in the app. Quizzes, practice tests and coding exercises are not available offline ([Mobile troubleshooting](https://support.udemy.com/hc/en-us/sections/360007276814-Mobile-Troubleshooting); exact offline exclusions **[secondary/unverified wording]**).
- Instructor course-management tools run on udemy.com and the mobile web, not in the iOS or Android apps. The apps only cover Q&A, reviews and notifications ([Platforms and Features](https://support.udemy.com/hc/en-us/articles/229233847-Udemy-Platforms-and-Features); [Instructor mobile, iOS](https://support.udemy.com/hc/en-us/articles/360007944213-Getting-Started-With-The-Instructor-Mobile-Experience-iOS)).
- **[unverified]:** the app's bottom-nav labels.

**Coherence across many authors.** Udemy does not try to make one curriculum. Coherence comes from:
- a quality gate at first publish (the checklist plus human review);
- a taxonomy (category, subcategory, topic) that cannot be edited after publish;
- ratings and reviews;
- badges.

Each course has one owner and can have co-instructors. Courses never share units.

## 3. Brilliant

**Hierarchy.** Learning Path → Course → Lesson → interactive problems. "Learning Paths are guided sequences of courses… in a logical order", with practice checkpoints along the way. Paths span levels from "Grades 4–7" to "Advanced", and they live on the Courses page ([What are Learning Paths?](https://brilliant.org/help/using-brilliant/what-are-learning-paths/)). Lessons are built from interactive problems, with "about 15 minutes" per lesson **[secondary: [upskillwise](https://upskillwise.com/reviews/brilliant/)]**.

**Discovery.**
- Learners pick a path or a course from the Courses page.
- Streaks, XP and Leagues drive return visits.
- An iOS widget shows the streak and suggested practice ([Product features](https://brilliant.org/help/features/)).
- **[unverified]:** the home screen's "continue" layout and the search behaviour.

**Authoring model.**
- Only in-house staff author. Content roles are "Learning Designer" (Math and CS) inside a team of practitioners, pedagogy experts, storytellers and animators ([Careers](https://brilliant.org/careers/); [About](https://brilliant.org/about/)).
- No public creator programme exists. Brilliant used to host community-submitted problems and a wiki (Wikipedia: [Brilliant (website)](https://en.wikipedia.org/wiki/Brilliant_(website))). **[unverified]:** when or how those ended.
- **[unverified]:** internal draft/review states and how courses are retired.
- **Visibility tiers:**
  - **Free:** two lessons a day, courses in sequential order, ads, and a limited tutor preview.
  - **Premium:** any order and unlimited.
  ([Brilliant Basics](https://brilliant.org/help/using-brilliant/); [Learning Paths](https://brilliant.org/help/using-brilliant/what-are-learning-paths/))

**Mobile vs web.** Web, iOS and Android have the same lessons, with progress synced. There is no offline mode: "lessons currently require an internet connection… and aren't available for download or offline use" ([Offline](https://brilliant.org/help/using-brilliant/can-i-download-brilliant-lessons-or-use-them-offline/)). Some third-party reviews claim a Premium offline mode on iOS, but the help centre contradicts them, so treat the help centre as current.

**Coherence across many authors.**
- One house style, because one team authors everything.
- Paths impose an order across courses.
- One lesson format (interactive problems).
- Gamification sits on top of the content rather than inside it.

---

## (a) Comparison

| | Khan Academy | Udemy | Brilliant | SPLAT today / Task 18 |
|---|---|---|---|---|
| Hierarchy | Course > Unit > Lesson > item (video/article/exercise) + quizzes, unit test, course challenge | Course > Section > item (lecture/quiz/exercise/practice test/assignment) | Path > Course > Lesson > problems | Course > Unit > Lesson (read/build/quiz) on web; 6 flat articles on mobile |
| Who publishes | Staff + vetted partners | Any instructor | Staff only | Code (lessons); admins edit the outline (Task 18) |
| Review gate | Peer review by content creators; human review of all content | Quality Review at first submit (~2 business days); later edits go live at once | Internal, not public | None (admin save is live) |
| States | Listed / not in Explore but reachable; internal states not public | Draft, In review, Published, Unpublished (enrolled students keep access), Deleted; privacy Public / Invite / Password | Not public | Free / Free, sign-in needed / Hidden (whole course) |
| Per-item publish | [unverified] | Yes (each curriculum item) | [unverified] | No (lessons are code pages) |
| Multi-author per unit | Team-owned | Owner + co-instructors with Visible / Manage permissions | Team-owned | Any admin, last write wins, `updated_by` recorded |
| Taxonomy | Domain > course; skills/mastery | Category > subcategory > topic (locked after publish) | Path; level band | None |
| Continue / resume | Learner Home, Resume Learning, My courses (9) | My learning | Streaks, XP, paths | Per-device localStorage "next up" |
| Paid / free | All free | Paid or free (free < 2 h, fewer features); free preview lectures | Free 2/day sequential; Premium open | Free; optional sign-in gate |
| Offline on mobile | Videos via Bookmarks | Lecture video only, encrypted | None | Articles bundled in app (fully offline) |
| Mobile omits | Programming talkthroughs | Authoring tools; offline practice | Nothing documented | Units, builds, checkpoints, Ask an expert |

**Pattern:** Khan and Brilliant have many authors but **one publisher**, with a fixed hierarchy and editorial review. Udemy has **many publishers**: each course has an owner, there is a quality gate at publish, and a taxonomy holds the catalogue together. SPLAT's Learn contributors are admins, which makes it the Khan/Brilliant case and not the Udemy case. SPLAT's Udemy-like pipeline already exists, as Guides with `draft/pending/approved/rejected`.

## (b) Three options for SPLAT Learn with multiple admin contributors

### Option 1: One course, several editors (Task 18 as planned, plus two small guards)
- **Shape:** keep one course with units and lessons. Lessons stay code pages. Any admin edits the outline in Site content.
- **Cost:**
  - Task 18 as already planned, with no migration.
  - Small additions:
    - Show "Last edited by {name}, {time}" from the existing `site_content.updated_by` and `updated_at`.
    - Send `updated_at` with the PUT and refuse a stale save (409), so two admins cannot silently overwrite each other. This is one comparison in `PUT /api/admin/content/:key`.
  - Lesson **content** still changes only through code, so mobile drift is unchanged.
- **What Hidden means:** the whole course is off for everyone (`/learn/*` shows "Course hidden", and so does the mobile Learn screen). This is like a global Udemy "unpublish" without the "enrolled keep access" rule, because SPLAT has no enrolment. The plan leaves three questions open, and they still need answers: does Ask an expert hide too, do admins still see the course, and does mobile honour sign-in-needed. Khan's precedent suggests a cheaper middle state, "not listed but reachable by link", but it is not needed while there is only one course.

### Option 2: Several courses, each with an owner (Khan/Udemy-style course list)
- **Shape:**
  - `/learn` becomes a catalogue of courses.
  - Each course has an owner admin, optional co-editors, a status (`draft`, `published`, `hidden`) and the existing "Shown as" access setting.
  - A unit or lesson belongs to exactly one course.
- **Cost (large):**
  - New tables: `learn_courses`, `learn_units`, `learn_lessons`, plus editors if co-owners are wanted, with RLS mirroring `tutorials`.
  - Lesson **bodies** have to move out of the 16 JSX pages and `learn-content.json` into data. Otherwise a second course can only be made by writing code, which defeats the point.
  - That means a block format for read, build and quiz lessons, an editor for it, and a dynamic route `/learn/[course]/[lesson]` with redirects from the current 16 slugs.
  - Mobile has to render the same data instead of `learn-content.ts`. This fixes the drift but means rebuilding the mobile Learn screens.
  - `learn-progress.ts` keys need a course prefix.
  - Parity boards: the artboards show one course, so the catalogue screen has no board source.
- **What Hidden means:** it becomes **per course** and splits into two states:
  - `draft` (never shown, and editors see a preview);
  - `hidden` (pulled from the catalogue). Either the link 404s, or the course stays reachable by link but unlisted (Khan's middle state). That choice needs a decision.
  - "Shown as: sign-in needed" stays a separate per-course access setting, like Udemy separating status from privacy.

### Option 3: Courses plus paths (Brilliant/Khan-domain style)
- **Shape:** Option 2, plus `learn_paths`, which are ordered lists of courses. Optionally Guides can be items in a path, for example "Start here, then build Guide X".
- **Cost:** everything in Option 2, plus:
  - a path table and an ordering editor;
  - a path-aware "next up" that crosses courses;
  - a decision on whether a path can include a Guide that is `approved` but later archived.

  There is no board source and no current content to fill a second path.
- **What Hidden means:** three levels. A hidden path removes a route but keeps its courses. A hidden course drops out of every path, and paths skip it. A hidden lesson is skipped. Each level needs its own "what does a direct link do" rule.

## (c) Recommendation

**Ship Option 1 now, and add the stale-save guard and "last edited by".**

The three products split cleanly. Platforms whose authors are trusted staff (Khan, Brilliant) keep one publisher and one fixed hierarchy and do not give authors per-course ownership. Ownership, review gates and taxonomy are Udemy's answer to *untrusted* authors at marketplace scale. SPLAT's Learn editors are admins, and there is one course with 16 lessons. SPLAT's untrusted-author pipeline already exists as Guides (`draft → pending → approved/rejected`). Contributor content should keep going there and not into Learn.

Option 2 only pays off once there is a real **second course** to publish. Its real cost is not the tables: it is moving lesson bodies out of JSX into data. When that point comes, do the body move first, because it also ends the hand-transcribed mobile drift in `learn-content.ts`. Then add the course list. Under that design, Hidden should become a per-course status, and "Shown as" should stay a separate access setting, following Udemy's status/privacy split. Skip Option 3 until there are at least three courses.

Open questions for Byron that Option 1 still needs answered (carried over from Task 18): does Hidden also hide `/learn/ask-an-expert`, do admins see a hidden course (Khan's "unlisted but reachable" suggests yes, with a banner), and should mobile honour "sign-in needed" (it cannot gate content that ships inside the app).

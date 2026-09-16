import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('pixel depth tokens', () => {
  const dir = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(dir, '../../../app/globals.css'), 'utf8')

  it('defines the hard-shadow depth scale', () => {
    expect(css).toMatch(/--shadow-pixel-sm:\s*2px 2px 0/)
    expect(css).toMatch(/--shadow-pixel-xs:\s*3px 3px 0/)
    expect(css).toMatch(/--shadow-pixel-md:\s*4px 4px 0/)
    expect(css).toMatch(/--shadow-pixel-card:\s*5px 5px 0/)
    expect(css).toMatch(/--shadow-pixel-lg:\s*6px 6px 0/)
  })

  /*
   * The second shadow ink, and the reason the depth scale above stopped
   * carrying the hierarchy on its own: five offsets one pixel apart are
   * invisible at a glance, so every rung read as the same plane. Weight is
   * what the eye sorts by. This value is not new — .btn-quiet has drawn its
   * shadow at exactly this since the foundation, and it is the only reason
   * "Browse the library" reads as secondary beside "+ New tutorial". The
   * 2026-08-29 hierarchy pass let it out of the button file.
   */
  it('defines the quiet shadow ink the ladder ranks by', () => {
    expect(css).toMatch(/--shadow-ink-quiet:\s*rgb\(18 40 58 \/ 0\.35\)/)
  })

  /*
   * Six radii, because the artboard draws six. Counted from the artboard:
   * 10px ×28 (cards, empty states), 8px ×21 (buttons, avatars, step badges),
   * 6px ×15 (art slots, inputs), 20px ×9 (filter chips), 4px ×7 (SOON badge),
   * 2px ×4 (the smallest ticks).
   */
  it('defines the full pixel radius scale', () => {
    expect(css).toMatch(/--radius-pixel:\s*10px/)
    expect(css).toMatch(/--radius-pixel-sm:\s*8px/)
    expect(css).toMatch(/--radius-pixel-slot:\s*6px/)
    expect(css).toMatch(/--radius-pixel-chip:\s*20px/)
    expect(css).toMatch(/--radius-pixel-xs:\s*4px/)
    expect(css).toMatch(/--radius-pixel-hair:\s*2px/)
  })

  it('defines all three pixel border weights', () => {
    expect(css).toMatch(/--border-pixel:\s*3px/)
    expect(css).toMatch(/--border-pixel-thin:\s*2px/)
    expect(css).toMatch(/--border-pixel-hair:\s*1px/)
  })

  /*
   * The board's placeholder colour (#8aa7b8) reaches only 2.53:1 on white,
   * against this project's non-negotiable 4.5:1. Nothing near it passes —
   * you reach --color-muted (6.34:1) before you clear the bar — so the token
   * was withdrawn and placeholders keep --color-muted. This test stops the
   * board's value being reintroduced from the artboard by a later pass.
   */
  it('keeps placeholders on an accessible colour', () => {
    expect(css).not.toContain('#8aa7b8')
    expect(css).toMatch(/::placeholder\s*\{[^}]*var\(--color-muted\)/)
  })

  it('wires the buttons to the diagonal shadow, not the old vertical one', () => {
    expect(css).toMatch(/\.pixel \.btn-accent \{[^}]*box-shadow: var\(--shadow-pixel-md\)/)
  })

  it('drops the squash-on-press transform', () => {
    expect(css).not.toContain('scaleY(0.94)')
  })

  it('wires the Jersey 10 display font into the theme', () => {
    expect(css).toMatch(/--font-display:\s*var\(--font-jersey\)/)
  })

  /*
   * Jersey 10 is a numeral face, not a display face. Across all twelve screens
   * of the artboard it appears exactly three times — the homepage hero stat
   * chips, at 22px/700 — and every h1, h2 and h3 on every screen is Nunito.
   * The foundation pass read the 2026-08-26 spec ("display font, headings
   * only") rather than the board, and put it on the hero headline and the step
   * badges. See 2026-08-27-pixel-page-templates-design.md, Corrections §1.
   */
  it('keeps the display face off the headings', () => {
    const hero = css.match(/\.title-hero \{[^}]*\}/)?.[0] ?? ''
    expect(hero).not.toContain('--font-display')

    const step = css.match(/\.pixel \.step-pixel \{[^}]*\}/)?.[0] ?? ''
    expect(step).not.toContain('--font-display')
  })

  it('gives the display face exactly one home: the numeral class', () => {
    const numeral = css.match(/\.numeral \{[^}]*\}/)?.[0] ?? ''
    expect(numeral).toMatch(/font-family:\s*var\(--font-display\)/)

    // Exactly one consumer. The token's own definition reads
    // `--font-display: var(--font-jersey), ...` and so does not match this
    // pattern — .numeral is the only hit there should ever be.
    const uses = css.match(/var\(--font-display\)/g) ?? []
    expect(uses).toHaveLength(1)
  })

  /*
   * The filter chip is the one element that keeps a pill radius — the board
   * draws it at 20px while everything else came down to the 10/8/6/4 scale.
   * Its two states are drawn as a contrast, not a tint shift: inactive is
   * white and stands off the page on a 3px shadow, active is an ink fill lying
   * flat with no shadow at all.
   */
  it('draws the filter chip as the board does', () => {
    const chip = css.match(/\.chip \{[^}]*\}/)?.[0] ?? ''
    expect(chip).toMatch(/border-radius:\s*var\(--radius-pixel-chip\)/)
    expect(chip).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(chip).toMatch(/box-shadow:\s*var\(--shadow-pixel-xs\) var\(--color-ink\)/)
    expect(chip).not.toContain('9999px')

    const active = css.match(/\.chip\[aria-pressed='true'\] \{[^}]*\}/)?.[0] ?? ''
    expect(active).toMatch(/background-color:\s*var\(--color-ink\)/)
    expect(active).toMatch(/box-shadow:\s*none/)
  })

  it('draws the badge as the board draws SOON', () => {
    const badge = css.match(/\.badge \{[^}]*\}/)?.[0] ?? ''
    expect(badge).toMatch(/border-radius:\s*var\(--radius-pixel-xs\)/)
    expect(badge).toMatch(/border:\s*var\(--border-pixel-hair\) solid currentColor/)
    expect(badge).not.toContain('9999px')
  })

  /* The board has no scale transform anywhere; a chip presses the same way a
     button does — it travels its own shadow offset and the edge disappears.

     The 3px is no longer written as a literal `.chip:active` rule: the shared
     press-motion block travels every family by its own --pop-rest, and the
     chip declares 3px. Same distance, one source. The chip's share of that is
     asserted precisely here; the shared machinery has its own guards in
     tests/unit/lib/press-motion.test.ts. */
  it('presses the chip by collapsing its shadow, not by scaling it', () => {
    const chip = css.match(/\.pixel \.chip \{[^}]*\}/)?.[0] ?? ''
    expect(chip).toMatch(/--pop-rest:\s*3px/)
    // The press itself: travel by --pop-rest, shadow to zero, never a scale.
    const press = css.slice(css.lastIndexOf('Press motion, in one place'))
    const active = press.match(/:active:not\(:disabled\)[^{]*\{[^}]*\}/)?.[0] ?? ''
    expect(active).toMatch(/transform:\s*translate\(var\(--pop-rest\), var\(--pop-rest\)\)/)
    expect(active).toMatch(/box-shadow:\s*0 0 0/)
    expect(active).not.toContain('scale(')
  })

  /* The board draws inputs with a 2px ink border at a 6px radius — the same
     weight and corner as every other bordered small thing on it. This shipped
     as a 1.5px --color-line hairline at --radius-field (14px), a value that is
     not in the board's radius vocabulary at all, while --radius-pixel-slot's
     own comment in this file already said "art slots and inputs at 6px". The
     token and the class disagreed; the token was right. */
  it('draws inputs at the board\'s border and radius', () => {
    const field = css.match(/\.field \{[^}]*\}/)?.[0] ?? ''
    expect(field).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(field).toMatch(/border-radius:\s*var\(--radius-pixel-slot\)/)
    // Below 44px is under the touch-target floor; the board has no fingers.
    expect(field).toMatch(/min-height:\s*44px/)
  })

  /* --radius-field is no longer what .field uses, but eight `rounded-field`
     call sites still consume it (the skip link, the nav menu button, the rail,
     an exchanges pill). Deleting an orphaned-looking token that something else
     still reads is the exact failure that has bitten this branch before. */
  it('keeps --radius-field while anything still consumes it', () => {
    expect(css).toMatch(/--radius-field:\s*14px/)
  })

  /* One border and one shadow around the pair, divider carried by the second
     tab — what makes the auth switch read as a single control. */
  it('draws the auth switch as one control, not two buttons', () => {
    const box = css.match(/\.auth-switch \{[^}]*\}/)?.[0] ?? ''
    expect(box).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(box).toMatch(/overflow:\s*hidden/)
    expect(box).toMatch(/box-shadow:\s*var\(--shadow-pixel-md\)/)
    expect(css).toMatch(/\.auth-switch a \+ a \{[^}]*border-left:\s*var\(--border-pixel-thin\)/)
    // The active tab is filled ink, not tinted — at 12px a tint would not carry.
    expect(css).toMatch(/\.auth-switch a\[aria-current='page'\] \{[^}]*background-color:\s*var\(--color-ink\)/)
  })

  /*
   * The card, and there is one of them.
   *
   * Until 2026-08-29 there were two: `.card-pixel` carried the board's card
   * from the foundation onward while `.card` kept the pre-Pixel 16px corner on
   * a blurred --shadow-rest. Two names for one object, and only one of them
   * ever got updated — which is how the signed-in side drifted while the
   * public side did not. This asserts the surviving one is the right one.
   */
  it('draws the card as the board does, at the browse weight', () => {
    const card = css.match(/\.card \{[^}]*\}/)?.[0] ?? ''
    expect(card).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(card).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(card).not.toContain('--shadow-rest')

    // Card depth, quiet ink. A card is the thing a page has most of, so it is
    // the one object that must not be drawn at the weight of a control.
    expect(card).toMatch(/box-shadow:\s*var\(--shadow-pixel-card\) var\(--shadow-ink-quiet\)/)
    expect(card).not.toMatch(/box-shadow:[^;]*var\(--color-ink\)/)
  })

  /*
   * Rung 3: a surface that holds content rather than answering a click keeps
   * its edge and loses its shadow, because a hard offset is a promise that
   * something can be pressed.
   *
   * The sort needs no per-call-site edit, because the answer was already in
   * the markup: anything clickable carries .card-link, and .panel and
   * .step-pill-row are the frame of every editor — one open form box and the
   * tray its step chips sit in. Neither is ever pressed.
   */
  it('takes the shadow off the surfaces that only hold content', () => {
    const passive =
      css.match(/\.panel,\s*\.step-pill-row,\s*\.card:not\(\.card-link\) \{[^}]*\}/)?.[0] ?? ''
    expect(passive).toMatch(/box-shadow:\s*none/)
  })

  /*
   * Rung 1 survives on the two families whose shadow is doing a different job.
   *
   * The launcher's three pillars rank against their four neighbours, which is
   * the whole reason .card-lead exists — at 6px solid over 5px solid it never
   * managed it, and over 5px quiet it does.
   *
   * The floating chrome — the sticky submit bar, the dock, the toast, the
   * dialog — is not being ranked at all: its shadow separates it from content
   * sliding underneath it, so flattening it would be a different bug wearing
   * this pass's clothes.
   */
  it('keeps solid ink where the shadow is not ranking anything', () => {
    const lead = css.match(/\.card-lead \{[^}]*\}/)?.[0] ?? ''
    expect(lead).toMatch(/box-shadow:\s*var\(--shadow-pixel-lg\) var\(--color-ink\)/)

    for (const sel of ['.sticky-submit-bar', '.dock-my-splat', '.edit-toast', '.dialog-panel']) {
      const rule = css.match(new RegExp(`\\${sel} \\{[^}]*\\}`))?.[0] ?? ''
      expect(rule, `${sel} lost the shadow that holds it off the content`).toMatch(
        /box-shadow:[^;]*var\(--color-ink\)/,
      )
    }
  })

  /*
   * Press motion reads the resting ink from --pop-color per family, so hover
   * and press follow the rest weight without restating it. Without these two
   * the cards would rest quiet and pop back to solid under the pointer.
   */
  it('carries the rest weight through to hover and press', () => {
    const card = css.match(/\.pixel \.card \{[^}]*\}/)?.[0] ?? ''
    expect(card).toMatch(/--pop-color:\s*var\(--shadow-ink-quiet\)/)
    expect(card).toMatch(/--pop-rest:\s*5px/)

    const lead = css.match(/\.pixel \.card-lead \{[^}]*\}/)?.[0] ?? ''
    expect(lead).toMatch(/--pop-color:\s*var\(--color-ink\)/)
    expect(lead).toMatch(/--pop-rest:\s*6px/)
  })

  // .card-tint had zero call sites when this ran. A tinted 16px box with no
  // edge is the one shape the sweep has no Pixel answer for, and it does not
  // need one.
  //
  // Matches the rule, not the name: the comment on .card above explains the
  // removal and names the class while doing so, which is the note being
  // useful rather than the class coming back.
  it('has dropped the .card-tint rule entirely', () => {
    expect(css).not.toMatch(/\.card-tint\s*\{/)
  })

  /*
   * The flat register: notification rows, the editor's file rows, the
   * parts/tools/files reference blocks, and every three-up stat tile. The
   * precedent is .field, which took exactly this pair on 2026-08-27 — and
   * whose own token comment already reads "art slots and inputs at 6px".
   */
  it('draws the flat card in the same register as an input', () => {
    const flat = css.match(/\.card-flat \{[^}]*\}/)?.[0] ?? ''
    expect(flat).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(flat).toMatch(/border-radius:\s*var\(--radius-pixel-slot\)/)
    expect(flat).not.toContain('--color-line')
  })

  /*
   * .panel is a card with overflow:hidden and always was. 20 of its 21 call
   * sites are the static section boxes EditStepper swaps in; the 21st is the
   * one surviving accordion, on /admin/organizations. The section comment
   * calling this "accordion panels" predates the stepper.
   *
   * It keeps the card's geometry and drops the card's shadow: 20 of those 21
   * are a box holding a form, which is rung 3 by definition. Its own rule must
   * declare no shadow at all — a `none` here would be an override of the
   * passive rule rather than the same answer, and the next person to read it
   * would have to work out which one was winning.
   */
  it('draws the panel at the card geometry with no depth of its own', () => {
    const panel = css.match(/\.panel \{[^}]*\}/)?.[0] ?? ''
    expect(panel).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(panel).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(panel).toContain('overflow: hidden')
    expect(panel).not.toContain('box-shadow')
    expect(panel).not.toContain('--shadow-rest')
  })

  /*
   * The alert's edge is currentColor, the same trick .badge uses: the three
   * variants (.alert-danger, .alert-warning, and the ad-hoc
   * `alert bg-brand-tint text-ink` call sites) each set their own ink, so one
   * declaration covers all of them with no per-variant rule.
   */
  it('gives the alert an edge in its own ink', () => {
    const alert = css.match(/\.alert \{[^}]*\}/)?.[0] ?? ''
    expect(alert).toMatch(/border:\s*var\(--border-pixel-thin\) solid currentColor/)
    expect(alert).toMatch(/border-radius:\s*var\(--radius-pixel-slot\)/)

    // The variants must keep supplying only colour — an edge declared on one
    // of them would be an edge the other two silently lack.
    const danger = css.match(/\.alert-danger \{[^}]*\}/)?.[0] ?? ''
    expect(danger).not.toContain('border')
  })

  /*
   * .pixel is on the body wrapper for every route (app/layout.tsx:104, :145),
   * so every `.pixel …` rule reaches the dashboard too. Four base declarations
   * those rules override had therefore never rendered anywhere, and the comment
   * claiming the dashboard was "deliberately out of scope" had been wrong since
   * the foundation shipped. It was also why the scope of the 2026-08-29 sweep
   * was misread on the first pass, which is the reason this test names it.
   */
  it('has no pre-Pixel declaration left for a .pixel rule to override', () => {
    const btn = css.match(/\.btn \{[^}]*\}/)?.[0] ?? ''
    expect(btn).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(btn).not.toContain('9999px')

    expect(css).not.toMatch(/\.pixel \.btn \{/)
    expect(css).not.toMatch(/\.card-link:hover \{/)

    for (const sel of ['.btn-primary', '.btn-accent']) {
      const rule = css.match(new RegExp(`\\${sel} \\{[^}]*\\}`))?.[0] ?? ''
      expect(rule, `${sel} still carries the soft shadow`).not.toContain('--shadow-rest')
    }

    // The claim itself, verbatim as it stood. The replacement comment
    // paraphrases it rather than quoting it, so this stays a live assertion
    // instead of matching the note that records the correction.
    expect(css).not.toContain('which only the public shell sets')
  })

  /*
   * The editor stepper, on all three editors. Everything here is .chip's
   * answer reused: the 20px pill radius survives because a step selector is
   * the same kind of low-stakes repeatable control a filter is, and the states
   * are a contrast rather than a tint shift — white standing off the page when
   * off, an ink fill lying flat when on.
   */
  it('draws the stepper in the chip register', () => {
    // The tray holds the chips; it is not one. At 5px solid it competed with
    // the 3px chips inside it, which are the thing you are actually choosing
    // between — and which carry the step's status marker.
    const row = css.match(/\.step-pill-row \{[^}]*\}/)?.[0] ?? ''
    expect(row).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(row).not.toContain('box-shadow')
    expect(row).not.toContain('--shadow-rest')

    const pill = css.match(/\.step-pill \{[^}]*\}/)?.[0] ?? ''
    expect(pill).toMatch(/border-radius:\s*var\(--radius-pixel-chip\)/)
    expect(pill).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(pill).toMatch(/box-shadow:\s*var\(--shadow-pixel-xs\) var\(--color-ink\)/)
    expect(pill).not.toContain('9999px')

    const active = css.match(/\.step-pill\[data-active\] \{[^}]*\}/)?.[0] ?? ''
    expect(active).toMatch(/background-color:\s*var\(--color-ink\)/)
    expect(active).toMatch(/box-shadow:\s*none/)

    const dot = css.match(/\.step-pill-dot \{[^}]*\}/)?.[0] ?? ''
    expect(dot).toMatch(/border-radius:\s*var\(--radius-pixel-hair\)/)
  })

  /*
   * The exchange thread — the one screen behind the rail a family spends real
   * time on, and four different shapes before this: round avatars, 16px
   * blurred bubbles, round daymarks and a 20px composer field.
   *
   * The avatar's target is not a derivation: .pixel .pixel-avatar is the
   * header's initials disc and already draws exactly this pair.
   */
  it('draws the chat thread in the pixel register', () => {
    const bubble = css.match(/\.chat-bubble \{[^}]*\}/)?.[0] ?? ''
    expect(bubble).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(bubble).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(bubble).toMatch(/box-shadow:\s*var\(--shadow-pixel-sm\) var\(--color-ink\)/)
    expect(bubble).not.toContain('--shadow-rest')

    const avatar = css.match(/\.chat-avatar \{[^}]*\}/)?.[0] ?? ''
    expect(avatar).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(avatar).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)

    // The daymark and the system line share one rule.
    const marks = css.match(/\.chat-daymark,\s*\n\s*\.chat-system \{[^}]*\}/)?.[0] ?? ''
    expect(marks).toMatch(/border-radius:\s*var\(--radius-pixel-xs\)/)

    // The composer stops overriding .field's radius rather than restating it.
    expect(css).not.toMatch(/\.chat-composer \.field \{/)
  })

  /*
   * The dropzone's dashed edge is already board vocabulary (it draws both 2px
   * and 3px dashed); only the weight and the corner move. .empty-badge is the
   * last 9999px shape on the site, and it becomes the same bordered square the
   * header avatar and the chat avatar already are.
   */
  it('draws the dropzone and the empty badge in the pixel register', () => {
    const drop = css.match(/\.dropzone \{[^}]*\}/)?.[0] ?? ''
    expect(drop).toMatch(/border:\s*var\(--border-pixel\) dashed var\(--color-ink\)/)
    expect(drop).toMatch(/border-radius:\s*var\(--radius-pixel\)/)

    const badge = css.match(/\.empty-badge \{[^}]*\}/)?.[0] ?? ''
    expect(badge).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(badge).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(badge).not.toContain('9999px')
  })

  /*
   * Both rode on --shadow-lift, the blurred halo the foundation replaced
   * outright. The bar is a card and takes a card's depth; the toast is a small
   * floating label and takes the chip register's.
   */
  it('lands the save bar and the toast on hard shadows', () => {
    const bar = css.match(/\.sticky-submit-bar \{[^}]*\}/)?.[0] ?? ''
    expect(bar).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(bar).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(bar).toMatch(/box-shadow:\s*var\(--shadow-pixel-card\) var\(--color-ink\)/)
    expect(bar).not.toContain('--shadow-lift')
    expect(bar).not.toContain('border-top')

    const toast = css.match(/\.edit-toast \{[^}]*\}/)?.[0] ?? ''
    expect(toast).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(toast).toMatch(/box-shadow:\s*var\(--shadow-pixel-xs\) var\(--color-ink\)/)
    expect(toast).not.toContain('9999px')
  })

  /*
   * The dock is the last soft pill on the site, and it floats over public
   * pages as well as the dashboard — so leaving it round would put a blurred
   * 9999px halo on top of every surface this sweep just squared off.
   */
  it('draws the dock as a control, not a pill', () => {
    const dock = css.match(/\.dock-my-splat \{[^}]*\}/)?.[0] ?? ''
    expect(dock).toMatch(/border-radius:\s*var\(--radius-pixel-sm\)/)
    expect(dock).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(dock).toMatch(/box-shadow:\s*var\(--shadow-pixel-md\) var\(--color-ink\)/)
    expect(dock).not.toContain('--shadow-lift')

    const dot = css.match(/\.dock-my-splat-dot \{[^}]*\}/)?.[0] ?? ''
    expect(dot).toMatch(/border-radius:\s*var\(--radius-pixel-hair\)/)
  })

  /*
   * A modal sits one rung deeper than an ordinary card because it floats over
   * the page: the shadow separates it from content behind it rather than
   * ranking it against anything.
   *
   * This used to cite auth-shell.tsx as the other object drawn a rung deeper
   * for having the screen to itself. The sign-in card joined rung 3 on
   * 2026-08-29 — it is a box holding a form, and it does not float — so the
   * pair no longer holds and the reasoning here stands on its own.
   */
  it('draws the dialog a rung deeper than a card', () => {
    const dialog = css.match(/\.dialog-panel \{[^}]*\}/)?.[0] ?? ''
    expect(dialog).toMatch(/border:\s*var\(--border-pixel\) solid var\(--color-ink\)/)
    expect(dialog).toMatch(/border-radius:\s*var\(--radius-pixel\)/)
    expect(dialog).toMatch(/box-shadow:\s*var\(--shadow-pixel-lg\) var\(--color-ink\)/)
    expect(dialog).not.toContain('--shadow-lift')

    const code = css.match(/\.dialog-panel code \{[^}]*\}/)?.[0] ?? ''
    expect(code).toMatch(/border-radius:\s*var\(--radius-pixel-xs\)/)
  })
})

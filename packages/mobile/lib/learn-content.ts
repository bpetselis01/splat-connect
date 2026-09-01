export type LearnArticle = {
  slug: string
  title: string
  intro: string
  minutes: number
  sections: { heading: string; paragraphs: string[] }[]
}

// Transcribed from the web Learn articles. Web is prose/JSX (Next.js pages);
// this is flattened plain-text data for the mobile reader. Edits on web do
// not reach here — if a web learn page changes, this file drifts and needs a
// manual re-transcription.
export const LEARN_ARTICLES: LearnArticle[] = [
  // Source: packages/web/app/learn/toy-adaptation-101/page.tsx
  // Edits there don't reach here — re-transcribe by hand if that page changes.
  {
    slug: 'toy-adaptation-101',
    title: 'Toy adaptation 101',
    intro:
      'Almost every adapted toy on this site works the same way, and the trick is smaller than you would expect. Once you have seen it once, you will see it everywhere.',
    minutes: 3,
    sections: [
      {
        heading: 'The problem',
        paragraphs: [
          'Most toys are switched on by a small stiff button, a slide, or by squeezing a particular spot. A child with limited hand strength, limited fine motor control, or involuntary movement may not be able to operate any of them — not because the toy is too complicated, but because the button is too small and in the wrong place.',
          'Adapting a toy does not change what it does. It moves the act of turning it on to a switch the child can operate: a big one, a light one, one mounted on a wheelchair tray, one worked with a cheek or a foot.',
        ],
      },
      {
        heading: 'The battery interrupter',
        paragraphs: [
          'Here is the whole idea. A battery-powered toy is a circuit, and that circuit runs through the battery compartment. If you break the circuit at one battery contact and route those two ends out to a switch, the toy only runs while the switch is held.',
          'A battery interrupter is a thin disc of insulating material with a metal contact on one face and a wire from each side. It slips between a battery and the spring contact in the compartment. No soldering inside the toy, no opening the case, and completely reversible — pull it out and the toy is exactly as it was.',
          'The two wires end in a 3.5 mm mono socket, which is the standard connector across assistive switches. Use it, and the toy will work with switches a family may already own.',
        ],
      },
      {
        heading: 'When an interrupter is not enough',
        paragraphs: [
          'Some toys will not cooperate. If the toy latches — one press starts it, another stops it — then cutting power mid-cycle may leave it stuck, or restart it from the beginning every time. If the toy has a microcontroller that needs to boot, it may not respond fast enough to a momentary switch.',
          "In those cases the adaptation moves inside: you open the toy and wire the switch in parallel with the toy's own button, so pressing either one does the same thing. That means soldering, and it means the guide for that toy will tell you exactly which two pads to bridge. This is where the library earns its keep — somebody has already worked it out.",
        ],
      },
      {
        heading: 'Momentary or latching',
        paragraphs: [
          'Momentary means the toy runs while the switch is held and stops when it is released. It is the simplest to build and, for many children, the most rewarding: cause and effect are immediate and unambiguous.',
          'Latching means one press starts it and the next stops it. It suits a child who cannot sustain a press, and it needs a latching switch interface between the switch and the toy rather than any change to the toy.',
        ],
      },
      {
        heading: 'What to read next',
        paragraphs: [
          'Switch types explained covers which switch suits which child, and choosing a toy to adapt covers which toys take to this well. When you are ready to build, the Guides have the step-by-step for specific toys.',
        ],
      },
    ],
  },

  // Source: packages/web/app/learn/switch-types/page.tsx
  // Edits there don't reach here — re-transcribe by hand if that page changes.
  {
    slug: 'switch-types',
    title: 'Switch types explained',
    intro:
      'A switch is the part the child actually touches, so it matters more than the toy does. Choosing it well is mostly about matching the movement a child already makes reliably.',
    minutes: 3,
    sections: [
      {
        heading: 'Start from the movement, not the switch',
        paragraphs: [
          'The question is never "which switch is best". It is: what movement can this child make consistently, with little effort, without having to look at what they are doing? A press with the side of a fist counts. So does a head turn. Build around that movement, and the switch choice usually follows.',
          'If a child has an occupational therapist or a speech pathologist, ask them first. They have probably already assessed this.',
        ],
      },
      {
        heading: 'Button switches',
        paragraphs: [
          'A large flat disc, typically 65–125 mm across, that clicks when pressed anywhere on its surface. This is the default for good reason: a big target tolerates imprecise aim, the click gives feedback, and it can be mounted flat on a tray or angled on a stand.',
          'Watch the activation force. A stiff button that needs a deliberate shove will exhaust a child with low tone within minutes.',
        ],
      },
      {
        heading: 'Lever switches',
        paragraphs: [
          'A paddle or wobble arm that moves sideways rather than being pressed down. Useful where a child sweeps or bats rather than pressing, and where a downward press is difficult — for instance from a reclined position. Because the arm moves through an arc, it can be caught anywhere along its length.',
        ],
      },
      {
        heading: 'Proximity switches',
        paragraphs: [
          "No contact and no force at all: the switch triggers when a hand, cheek or head comes within a few centimetres. The right answer for a child whose movement is too weak or too painful for any mechanical switch. The trade-off is feedback — there is no click, so the toy's own response has to be immediate and obvious, and accidental triggers are easy.",
        ],
      },
      {
        heading: 'Grasp and squeeze switches',
        paragraphs: [
          'A soft bulb or pad activated by closing a hand around it. Suits a child with a reliable grasp reflex but poor reach, and it can be held rather than mounted, which sidesteps the mounting problem entirely.',
        ],
      },
      {
        heading: 'Mounting is half the job',
        paragraphs: [
          'A well-chosen switch in the wrong place is a switch the child cannot use. It needs to be exactly where their movement naturally lands, stay there when knocked, and be repeatable tomorrow. Gooseneck mounts, hook-and-loop on a tray, and a non-slip base all beat holding it in place by hand.',
        ],
      },
      {
        heading: 'Where to get them',
        paragraphs: [
          'Commercial assistive switches cost anywhere from $40 to several hundred. Many designs can be printed and built for a fraction of that — see 3D printing basics and the Guides. Whatever you use, standardise on a 3.5 mm mono plug so switches and toys stay interchangeable.',
        ],
      },
    ],
  },

  // Source: packages/web/app/learn/choosing-a-toy/page.tsx
  // Edits there don't reach here — re-transcribe by hand if that page changes.
  {
    slug: 'choosing-a-toy',
    title: 'Choosing a toy to adapt',
    intro:
      "The best toy to adapt is one the child already wants. Everything below is about whether that toy will cooperate — and if it won't, what to look for instead.",
    minutes: 3,
    sections: [
      {
        heading: 'Signs a toy will be easy',
        paragraphs: [
          'It runs on AA, AAA, C or D cells. A removable cylindrical battery is what a battery interrupter needs.',
          'It does one thing. Press and it lights up, spins, sings. Single-function toys give unambiguous cause and effect, which is the whole point for a child learning that their action changes the world.',
          'Activation is momentary. Hold the button and it runs; let go and it stops. This maps directly onto a switch with no extra electronics.',
          'The battery compartment is roomy. An interrupter plus its wires need somewhere to sit and somewhere to leave the case.',
        ],
      },
      {
        heading: 'Signs a toy will fight you',
        paragraphs: [
          'Mains power, or a plug-in adapter. Do not adapt these, at all. See the safety page.',
          'A sealed or soldered-in battery, including rechargeable toys with a USB port. Nothing to interrupt.',
          'A button cell held in by a clip rather than a screw. Serious hazard, and not worth the risk. If the compartment does not screw shut, pick a different toy.',
          'Menus, modes, or a startup sequence. A toy that needs three presses to get going will frustrate a child using one switch.',
          'Latching behaviour — one press on, one press off. Adaptable, but it needs a latching interface rather than a plain switch.',
        ],
      },
      {
        heading: 'Match the toy to the child, not to your skills',
        paragraphs: [
          'A toy that is easy to adapt but boring to the child is wasted effort. Ask what they already reach for. Consider what they get from it: is it the light, the sound, the vibration, the movement? A child with low vision may want the toy that rattles, not the one that flashes. A child who is sound-sensitive will hate the one that sings.',
        ],
      },
      {
        heading: 'Check the library first',
        paragraphs: [
          'Before you open anything, search the Guides. Somebody may have adapted that exact toy and written down which wire goes where — including the traps. If they have not, and you work it out, please write it up: the next parent gets to skip the hard part.',
        ],
      },
    ],
  },

  // Source: packages/web/app/learn/tools-and-materials/page.tsx
  // Edits there don't reach here — re-transcribe by hand if that page changes.
  {
    slug: 'tools-and-materials',
    title: 'Tools and materials',
    intro:
      'A first adaptation needs surprisingly little. Here is what actually gets used, separated from what a hobby electronics shop will try to sell you.',
    minutes: 3,
    sections: [
      {
        heading: 'The minimum',
        paragraphs: [
          'A small Phillips screwdriver set. Toy screws are tiny, and often recessed down a narrow shaft. This is the tool you will reach for on every single build.',
          'Wire strippers, or a sharp pair of side cutters and patience.',
          'Stranded hook-up wire, 22–24 AWG. Stranded, not solid: solid core work-hardens and snaps where it flexes.',
          '3.5 mm mono sockets. Buy ten; they cost very little and you will use them all.',
          'Heat-shrink tubing in two or three diameters. Insulating tape works but comes unstuck inside a toy that gets shaken.',
        ],
      },
      {
        heading: 'Soldering, when you get to it',
        paragraphs: [
          'A temperature-controlled iron around 30–60 W, 60/40 or lead-free rosin-core solder, a brass-wool tip cleaner, and a stand. A cheap fixed-temperature iron will do a first build, but it will also lift pads and melt plastic, so it is a false economy if you plan more than one.',
          'Helping hands or a small vice are not optional in practice — two hands are already committed to the iron and the solder.',
        ],
      },
      {
        heading: 'Nice to have',
        paragraphs: [
          'A multimeter. Continuity mode alone will save you an hour per build. It answers "is this joint actually connected" without guessing.',
          'A plastic spudger or guitar pick, for opening clipped cases without gouging them.',
          'A parts tray with compartments. Toy screws are different lengths and go back in specific holes.',
          'Cable ties for strain relief, trimmed flush.',
        ],
      },
      {
        heading: 'Battery interrupters',
        paragraphs: [
          'Buy them, or print them. Commercial ones cost a few dollars each and work immediately. Printed ones need a thin conductive contact — copper tape or a trimmed brass shim — and are worth it if you are doing many builds. Sizes are per battery type, so a AA interrupter will not fit a AAA compartment.',
        ],
      },
      {
        heading: 'What to borrow rather than buy',
        paragraphs: [
          "A 3D printer is the big one. Libraries, makerspaces, men's sheds, schools and universities often have one and are usually delighted to be asked. Some SPLAT organisations hold printers for exactly this. You do not need to own a printer to build a printed switch — see 3D printing basics.",
        ],
      },
      {
        heading: 'Per-guide parts lists',
        paragraphs: [
          'Every guide in the Guides library lists its own parts with links to buy them, so you do not have to work out quantities. Read the list before you start, not halfway through.',
        ],
      },
    ],
  },

  // Source: packages/web/app/learn/safety-and-cleaning/page.tsx
  // Edits there don't reach here — re-transcribe by hand if that page changes.
  {
    slug: 'safety-and-cleaning',
    title: 'Safety and cleaning',
    intro:
      "This article is the practical companion to the site's formal safety page. Read both before your first handover.",
    minutes: 3,
    sections: [
      {
        heading: 'The three that actually hurt children',
        paragraphs: [
          'Button and coin cells. Swallowed, they burn through tissue within hours. The compartment must close with a screw, and that screw must be in and tight. If it does not screw shut, do not adapt the toy.',
          'Loose small parts. Screws, springs, trimmed wire ends and printed fragments. Work over a tray, count screws out and back in, and shake the finished toy hard next to your ear.',
          'Mains power. Never. Battery toys only.',
        ],
      },
      {
        heading: 'Making a joint that survives a child',
        paragraphs: [
          'The failure mode is always the same: someone pulls the switch lead and the wire tears out of the toy, leaving bare copper inside a rattling plastic shell. Two habits prevent it. Insulate every joint with heat-shrink rather than tape, and strain-relieve the cable where it exits the case — a cable tie or a knot inside the shell, so a pull is taken by the case and not by the solder.',
        ],
      },
      {
        heading: 'Cleaning an adapted toy',
        paragraphs: [
          'Assume the toy will go in a mouth. Wipe hard surfaces with warm soapy water or an alcohol wipe, and let them dry fully before the batteries go back. Never submerge an adapted toy, and never put printed parts in a dishwasher — PLA deforms well below dishwasher temperature.',
          'Fabric toys are harder. If the electronics are in a removable pod, wash the fabric and keep the pod out. If they are sewn in, tell the family it is surface-clean only, because they will otherwise find out the expensive way.',
        ],
      },
      {
        heading: 'Printed parts specifically',
        paragraphs: [
          'Sand or file every edge a hand will touch — layer lines are sharper than they look. Print at an infill high enough that a part cannot snap into shards; the guide will state a figure. Printed plastic is porous and not food safe, so anything a child mouths regularly should be a smooth commercial part rather than a printed one.',
        ],
      },
      {
        heading: 'The handover checklist',
        paragraphs: [
          'Shake it. Listen for anything loose.',
          'Check every screw, battery compartment first.',
          'Pull the switch lead firmly. Nothing should move at the toy end.',
          'Test it with the actual switch the child will use.',
          'Wipe it down.',
          'Say what you changed, and how to clean it. A parent needs to know there is a modified battery compartment in there.',
          'The full formal guidance, including what to do if you find a problem with a published guide, is on the safety page.',
        ],
      },
    ],
  },

  // Source: packages/web/app/printing/basics/page.tsx
  // Edits there don't reach here — re-transcribe by hand if that page changes.
  {
    slug: 'printing-basics',
    title: '3D printing basics',
    intro:
      'Many switches, mounts and battery interrupters on this site are printed. You do not need to own a printer, and you do not need to understand slicing deeply — just enough to get a part that holds up.',
    minutes: 3,
    sections: [
      {
        heading: "If you don't have a printer",
        paragraphs: [
          "Ask a library, a makerspace, a men's shed, a school or a university. Many have printers sitting idle and staff who would rather they were used for this than for another keyring. Some SPLAT organisations hold printers specifically for assistive parts. Hand over the STL file from the guide and the settings below; that is all a printer operator needs.",
        ],
      },
      {
        heading: 'Which filament',
        paragraphs: [
          'PLA for most parts. Easy, cheap, dimensionally accurate, stiff enough for switch housings. Its weakness is heat — a PLA part left on a car dashboard will sag.',
          'PETG where a part flexes or takes repeated impact, such as a lever arm or a clamp. Tougher than PLA, slightly fussier to print, and it tolerates warmth.',
          'Avoid ABS unless you have an enclosed printer and good ventilation. The fumes are unpleasant and it warps badly.',
          'Avoid flexible filament for a first print. It needs a direct-drive extruder and a lot of patience.',
        ],
      },
      {
        heading: 'Settings that matter',
        paragraphs: [
          'Layer height 0.2 mm. The default, and fine for everything here. Go finer only for a part with fine detail.',
          'Infill 30–40% for structural parts, and three or more perimeters. Strength in printed parts comes more from perimeters than from infill.',
          'Print orientation decides strength. Layers separate under load more readily than they break. Lay a lever flat so the stress runs along the layers, not across them.',
          'Supports only where the guide says. Every support leaves a surface you then have to clean up.',
        ],
      },
      {
        heading: 'Finishing',
        paragraphs: [
          "File or sand every edge a child will touch. Remove supports fully, then check the part against the guide's photographs — a stray blob in a switch housing will stop it clicking. Test-fit before you glue or screw anything, because a part that is 0.2 mm out is easier to reprint than to force.",
        ],
      },
      {
        heading: 'Cleaning and safety',
        paragraphs: [
          'Printed parts are porous and not food safe. Wipe with warm soapy water; never a dishwasher. If a part will be mouthed regularly, use a commercial smooth part instead. More in safety and cleaning.',
        ],
      },
    ],
  },
]

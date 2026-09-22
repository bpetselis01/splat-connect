/**
 * The component sheet. A real route in the prototype (/design-system), and the
 * page a developer opens instead of guessing what a control looks like.
 *
 * Laid out as the board's "Component sheet" draws it — ramp, a buttons matrix,
 * inputs, selection controls, chips, feedback, skeletons, elevation, the bear —
 * but every specimen is the product's own class (btn, chip, field, save-btn,
 * Badge, Alert), so the sheet can only show what the product really renders.
 * The matrix's hover and focus columns use the same `data-state` forcing as
 * /design-system/states (see the forced-state block in app/globals.css).
 *
 * Where the product has no class for something the board draws — a ghost
 * button, an input's error and success borders, the ink toast — the specimen
 * carries the board's values inline, and says so beside it.
 *
 * A server component with no state: the only interaction is the browser's own.
 */
import {
  CheckCircle,
  CircleNotch,
  Heart,
  Minus,
  Plus,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react/dist/ssr'
import type { CSSProperties, ReactNode } from 'react'
import { Badge } from '@/components/badge'
import { Alert } from '@/components/alert'
import { SplatMascot, type MascotPose } from '@/components/splat-mascot'

export const metadata = { title: 'Component sheet — SPLAT Connect' }

/** The eleven brand steps with the hex each token resolves to in light mode. */
const RAMP: Array<[number, string]> = [
  [50, '#f0f9ff'],
  [100, '#dcf0fb'],
  [200, '#b9e1f7'],
  [300, '#87cdf0'],
  [400, '#4fb4e6'],
  [500, '#1998d5'],
  [600, '#1179b0'],
  [700, '#0f5f8c'],
  [800, '#124f73'],
  [900, '#14425f'],
  [950, '#0d2a3f'],
]

const COLS = ['Default', 'Hover', 'Focus-visible', 'Loading', 'Disabled']

// The board's fifth pose (sleeping) has no drawing in components/splat-mascot.tsx.
const POSES: Array<[MascotPose, string, string]> = [
  ['wave', 'Waving', 'Onboarding, hero, welcome back'],
  ['think', 'Thinking', 'Empty states, filters, help'],
  ['party', 'Celebrating', 'Success, profile complete, handoff done'],
  ['hold', 'Holding a switch', 'Wizard, guide sidebars, "works with"'],
]

/* No .btn-ghost exists in the product; the board's ghost is transparent with
   --b700 text, so the row carries it inline. */
const GHOST: CSSProperties = {
  background: 'transparent',
  borderColor: 'transparent',
  boxShadow: 'none',
  color: 'var(--b700)',
  padding: '0 16px',
}

function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card flex flex-col gap-3.5 p-6 ${className}`}>
      <h2 className="font-display text-2xl font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children, muted }: { label: string; children: ReactNode; muted?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-extrabold ${muted ? 'text-muted' : 'text-ink'}`}>
      {label}
      {children}
    </label>
  )
}

const Dot = () => <i className="inline-block h-1.5 w-1.5 rounded-full bg-current" />


const skeleton = 'rounded-[var(--radius-field)] bg-sunken'

export default function DesignSystemPage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="eyebrow text-muted">Design system · Soft Pop</p>
        <h1 className="mb-2 mt-1 font-display text-[44px] font-extrabold leading-[1.1] text-ink">
          Components &amp; states
        </h1>
        <p className="m-0 max-w-[70ch] text-[17px] text-muted">
          Every control at 44px+, a visible 3px ink focus ring (never a glow), state carried by
          icon + label as well as colour. Switch the colour mode in the nav to audit dark and
          high-contrast.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(11,minmax(0,1fr))] gap-2">
        {RAMP.map(([step, hex]) => (
          <div key={step} className="flex flex-col gap-1.5">
            <div
              className="h-14 rounded-[var(--radius-field)]"
              style={{ background: `var(--brand-${step})`, boxShadow: 'var(--shadow-hi)' }}
            />
            <span className="font-mono text-[11px] font-semibold text-muted">
              {step}
              <br />
              {hex}
            </span>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3.5 font-display text-2xl font-extrabold text-ink">Buttons</h2>
        <div className="card grid grid-cols-[120px_repeat(5,minmax(0,1fr))] items-center gap-3 p-6">
          <span />
          {COLS.map((c) => (
            <span key={c} className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
              {c}
            </span>
          ))}

          <span className="text-sm font-extrabold">Primary</span>
          <button type="button" className="btn btn-primary">Find a guide</button>
          <button type="button" className="btn btn-primary" data-state="hover">Find a guide</button>
          <button type="button" className="btn btn-primary" data-state="focus">Find a guide</button>
          <button type="button" className="btn btn-primary" data-loading="true" aria-busy="true">
            <span className="inline-flex gap-[3px]" aria-hidden="true"><Dot /><Dot /><Dot /></span>
            Saving
          </button>
          <button type="button" className="btn btn-primary" disabled>Find a guide</button>

          <span className="text-sm font-extrabold">Secondary</span>
          <button type="button" className="btn btn-quiet">Borrow a toy</button>
          <button type="button" className="btn btn-quiet" data-state="hover">Borrow a toy</button>
          <button type="button" className="btn btn-quiet" data-state="focus">Borrow a toy</button>
          <button type="button" className="btn btn-quiet text-muted" aria-busy="true">
            <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden="true" />
            Loading
          </button>
          <button type="button" className="btn btn-quiet" disabled>Borrow a toy</button>

          <span className="text-sm font-extrabold">Ghost</span>
          <button type="button" className="btn" style={GHOST}>Skip for now</button>
          <button type="button" className="btn" style={{ ...GHOST, background: 'var(--surface2)' }}>
            Skip for now
          </button>
          <button type="button" className="btn" style={GHOST} data-state="focus">Skip for now</button>
          <span />
          <button type="button" className="btn" style={{ ...GHOST, color: 'var(--muted)', opacity: 0.5 }} disabled>
            Skip for now
          </button>

          <span className="text-sm font-extrabold">Danger</span>
          <button type="button" className="btn btn-danger"><Trash size={16} weight="bold" aria-hidden="true" /> Delete</button>
          <button type="button" className="btn btn-danger" data-state="hover"><Trash size={16} weight="bold" aria-hidden="true" /> Delete</button>
          <button type="button" className="btn btn-danger" data-state="focus"><Trash size={16} weight="bold" aria-hidden="true" /> Delete</button>
          <span />
          <button type="button" className="btn btn-danger" disabled><Trash size={16} weight="bold" aria-hidden="true" /> Delete</button>

          <span className="text-sm font-extrabold">Icon</span>
          <button type="button" className="save-btn" aria-label="Save"><Heart aria-hidden="true" /></button>
          {/* .save-btn's hover is a :hover scale with no forcing rule; drawn inline. */}
          <button
            type="button"
            className="save-btn"
            aria-label="Save"
            style={{ transform: 'scale(1.08)', boxShadow: 'var(--shadow-e3)', color: 'var(--coral)' }}
          >
            <Heart aria-hidden="true" />
          </button>
          <button type="button" className="save-btn" aria-label="Save" style={{ outline: '3px solid var(--focus)', outlineOffset: 3 }}>
            <Heart aria-hidden="true" />
          </button>
          <button type="button" className="save-btn is-saved" aria-label="Saved" aria-pressed="true">
            <Heart weight="fill" aria-hidden="true" />
          </button>
          <button type="button" className="save-btn" aria-label="Save" disabled style={{ background: 'var(--surface2)', opacity: 0.5 }}>
            <Heart aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Inputs" className="gap-4">
          <Field label="Default">
            <input className="field" placeholder="Search by toy name" />
          </Field>
          {/* Focus, error and success have no forcing attribute on .field; the
              board's values, inline. */}
          <Field label="Focus">
            <input
              className="field"
              defaultValue="Bubble mach"
              style={{ borderColor: 'var(--brand)', outline: '3px solid var(--focus)', outlineOffset: 2 }}
            />
          </Field>
          <Field label="Error">
            <input
              className="field"
              defaultValue="sam@"
              aria-invalid="true"
              aria-describedby="ds-err"
              style={{ border: '2px solid var(--bad)' }}
            />
            <span id="ds-err" className="flex items-center gap-1.5 text-[13px] font-semibold text-danger">
              <WarningCircle weight="fill" aria-hidden="true" /> That email is missing the part after @
            </span>
          </Field>
          <Field label="Success">
            <input className="field" defaultValue="sam@example.com" style={{ border: '2px solid var(--ok)' }} />
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
              <CheckCircle weight="fill" aria-hidden="true" /> Looks good
            </span>
          </Field>
          <Field label="Disabled" muted>
            <input className="field" defaultValue="Not editable" disabled />
          </Field>
          <Field label="Select">
            <select className="field" defaultValue="Easy">
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </Field>
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Selection controls">
            <div className="flex flex-wrap items-center gap-4 font-bold">
              <label className="flex items-center gap-2.5">
                <input type="checkbox" defaultChecked className="h-6 w-6 accent-[var(--b600)]" /> Checked
              </label>
              <label className="flex items-center gap-2.5">
                <input type="checkbox" className="h-6 w-6 accent-[var(--b600)]" /> Unchecked
              </label>
              <label className="flex items-center gap-2.5">
                <input type="radio" name="ds-r" defaultChecked className="h-6 w-6 accent-[var(--b600)]" /> Radio
              </label>
              <label className="flex items-center gap-2.5 text-muted">
                <input type="checkbox" disabled className="h-6 w-6" /> Disabled
              </label>
            </div>
            {/* The product's switch is a chip with role="switch" (see the site
                content editor), so that is what the sheet shows. */}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" role="switch" aria-checked="true" data-on="true" className="chip">
                Email me updates · On
              </button>
              <button type="button" role="switch" aria-checked="false" className="chip">
                Off
              </button>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm font-extrabold">
                <span>Palm width</span>
                <span className="font-mono">55 mm</span>
              </div>
              <div className="flex items-center gap-2.5">
                <button type="button" aria-label="Decrease" className="grid h-11 w-11 place-items-center rounded-[var(--radius-field)] border border-line bg-surface text-ink">
                  <Minus weight="bold" aria-hidden="true" />
                </button>
                <input
                  type="range"
                  min={30}
                  max={90}
                  defaultValue={55}
                  aria-label="Palm width"
                  className="h-11 flex-1 accent-[var(--b600)]"
                />
                <button type="button" aria-label="Increase" className="grid h-11 w-11 place-items-center rounded-[var(--radius-field)] border border-line bg-surface text-ink">
                  <Plus weight="bold" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Stepper buttons are the WCAG 2.5.7 single-pointer alternative to dragging.
              </p>
            </div>
          </Card>

          <Card title="Chips, badges, status">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip">Easy</button>
              <button type="button" className="chip" aria-pressed="true">Under 30 min</button>
              <button type="button" className="browse-chip">
                Palm press <X size={14} weight="bold" className="p-1" aria-label="Remove filter" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge status="approved" label="Approved" />
              <Badge status="pending" label="Pending review" />
              <Badge status="rejected" label="Sent back" />
              <Badge status="draft" label="Draft" />
              <Badge status="accepted" label="Backed" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge status="easy" label="Easy" />
              <Badge status="medium" label="Medium" />
              <Badge status="hard" label="Hard" />
              <Badge status="prototype" label="Prototype" />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Feedback">
          <Alert tone="ok">Guide saved to your list.</Alert>
          <Alert tone="warn">Cords longer than 20cm are a strangulation risk.</Alert>
          <Alert tone="bad">Upload failed — the file is over 50 MB.</Alert>
          <Alert tone="info">Only needed for printed grips and mounts.</Alert>
          {/* The board's toast. components/toast.tsx still draws a fixed green
              box, so this one is the board's, inline. */}
          <div
            className="flex items-center gap-2.5 self-center rounded-pill px-[18px] py-3 text-sm font-bold"
            style={{ background: 'var(--ink)', color: 'var(--canvas)', boxShadow: 'var(--shadow-e4)' }}
          >
            <CheckCircle size={20} weight="fill" style={{ color: 'var(--mint)' }} aria-hidden="true" />
            Toast · Request sent
          </div>
        </Card>

        <Card title="Skeletons & progress">
          <div className="flex gap-3">
            <div className={`h-[72px] w-[72px] ${skeleton}`} />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`h-4 w-[70%] ${skeleton}`} />
              <div className={`h-3 w-full ${skeleton}`} />
              <div className={`h-3 w-[45%] ${skeleton}`} />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-[13px] font-extrabold">
              <span>Uploading jack-clip-v3.stl</span>
              <span className="font-mono">64%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={64}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
              className="h-2.5 overflow-hidden rounded-pill bg-sunken"
            >
              <div className="h-full rounded-pill" style={{ width: '64%', background: 'var(--b600)' }} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {['var(--ok)', 'var(--ok)', 'var(--b600)', 'var(--line)', 'var(--line)'].map((bg, i) => (
              <span key={i} className="h-2 flex-1 rounded-pill" style={{ background: bg }} />
            ))}
            <span className="ml-1.5 text-xs font-extrabold text-muted">Step 3 of 5</span>
          </div>
          <div className="flex items-center gap-2">
            {[
              ['SM', 'var(--tmint)'],
              ['F3', 'var(--tviolet)'],
              ['O1', 'var(--tcoral)'],
              ['+4', 'var(--surface2)'],
            ].map(([ini, bg]) => (
              <span
                key={ini}
                className="grid h-10 w-10 place-items-center rounded-full text-[13px] font-extrabold"
                style={{ background: bg, color: ini === '+4' ? 'var(--muted)' : 'var(--tink)' }}
              >
                {ini}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Elevation & radii">
          <div className="grid grid-cols-4 gap-3">
            {[
              ['e1 · sm', 'var(--shadow-e1)', 'var(--radius-field)'],
              ['e2 · md', 'var(--shadow-e2)', 'var(--radius-inset)'],
              ['e3 · lg', 'var(--shadow-e3)', 'var(--radius-inset)'],
              ['e4 · xl', 'var(--shadow-e4)', 'var(--radius-card)'],
            ].map(([label, shadow, radius]) => (
              <div
                key={label}
                className="grid h-16 place-items-center bg-surface font-mono text-[11px] font-semibold"
                style={{ boxShadow: shadow, borderRadius: radius }}
              >
                {label}
              </div>
            ))}
          </div>
          <div
            className="grid h-16 place-items-center rounded-pill font-mono text-xs font-semibold"
            style={{ background: 'var(--b600)', color: 'var(--onbrand)', boxShadow: 'var(--shadow-glow), var(--shadow-hi)' }}
          >
            brand glow · pill · inner highlight
          </div>
          <p className="m-0 text-[13px] leading-[1.5] text-muted">
            Depth = layered soft shadow + top inner highlight + 1px hairline. High-contrast mode
            drops shadows and doubles borders.
          </p>
        </Card>
      </div>

      <div>
        <h2 className="mb-1 font-display text-2xl font-extrabold text-ink">Mascot — &ldquo;Splat&rdquo; the bear</h2>
        <p className="mb-3.5 max-w-[70ch] text-muted">
          Periwinkle bear, peach cheeks, slate features. Each pose has a small idle loop; inline
          SVG, one React component with a pose prop.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POSES.map(([pose, label, use]) => (
            <div key={pose} className="card flex flex-col items-center gap-2.5 p-4">
              <div className="grid w-full place-items-center overflow-hidden rounded-[var(--radius-inset)] bg-sunken py-2">
                <SplatMascot pose={pose} width={120} />
              </div>
              <span className="whitespace-nowrap text-[15px] font-extrabold">{label}</span>
              <span className="text-center text-xs text-muted">{use}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="flex items-center gap-4 rounded-card p-[22px]" style={{ background: 'var(--tamber)', color: 'var(--tink)' }}>
            <SplatMascot pose="hold" width={90} />
            <div>
              <p className="m-0 text-[15px] font-extrabold">On a tinted card</p>
              <p className="m-0 mt-1 text-[13px] leading-[1.5]">The hero &ldquo;contribute&rdquo; card.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-card border border-dashed border-line bg-surface p-[22px]">
            <SplatMascot pose="think" width={90} />
            <div>
              <p className="m-0 text-[15px] font-extrabold">Empty state</p>
              <p className="m-0 mt-1 text-[13px] leading-[1.5] text-muted">Nothing matched those filters.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-card p-[22px]" style={{ background: 'var(--b600)', color: 'var(--onbrand)' }}>
            <SplatMascot pose="wave" width={90} />
            <div>
              <p className="m-0 text-[15px] font-extrabold">On brand blue</p>
              <p className="m-0 mt-1 text-[13px] leading-[1.5] opacity-90">
                Body stays legible on b600; avoid b300–b400 backgrounds.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

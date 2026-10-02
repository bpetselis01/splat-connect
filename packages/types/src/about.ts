// The About page's words, read by web's /about and /contact and the app's
// About screen, so the two never say different things.

export const ABOUT_LEAD =
  'SPLAT stands for Supporting Play by Adapting Toys. We make toy adaptation knowledge discoverable and shareable, so a parent who has never held a soldering iron can still get a toy their child can start. The knowledge on the platform is free and stays free. The making is given time; you cover the parts.'

export const ABOUT_PILLARS = [
  { t: 'No paid tier, ever', d: 'No commission, no ads, nothing to subscribe to. If a family cannot afford it, it does not work.' },
  { t: 'Reviewed, not just posted', d: 'Every guide is read by an administrator or an organisation leader before it goes public.' },
  { t: 'Information, not devices', d: 'We publish instructions. We do not manufacture, supply or prescribe anything.' },
] as const

export const ABOUT_TEAM_BLURB = 'The people behind the platform.'

export const CONTACT_TIMES = [
  { k: 'Safety report', v: 'Same day' },
  { k: 'Everything else', v: '2 to 5 days' },
  { k: 'Weekends', v: 'Slower' },
] as const

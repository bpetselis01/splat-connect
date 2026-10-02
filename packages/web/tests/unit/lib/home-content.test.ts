import { describe, it, expect } from 'vitest'
import { HOME_HERO, homeHero, heroHeadline, homeNumbers, homeScenes } from '@/lib/home-content'

describe('homeHero', () => {
  it('takes each saved field over the page copy, and keeps the page copy for a blank one', () => {
    const hero = homeHero({ headline: 'Press the big one.', subhead: '   ', primary_label: 42 })
    expect(hero.headline).toBe('Press the big one.')
    expect(hero.subhead).toBe(HOME_HERO.subhead)
    expect(hero.primary_label).toBe(HOME_HERO.primary_label)
  })
  it('is the page copy when nothing was saved', () => {
    expect(homeHero(null)).toEqual(HOME_HERO)
  })
})

describe('heroHeadline', () => {
  it('breaks after the first sentence and accents the last word', () => {
    expect(heroHeadline('Press it. Watch it go.')).toEqual({ lines: ['Press it.', 'Watch it'], accent: 'go.' })
  })
  it('keeps a one-sentence headline on one line', () => {
    expect(heroHeadline('Every child can play')).toEqual({ lines: ['Every child can'], accent: 'play' })
  })
  it('lets a one-word second sentence be the accent alone', () => {
    expect(heroHeadline('Press it. Go.')).toEqual({ lines: ['Press it.', ''], accent: 'Go.' })
  })
})

describe('homeNumbers', () => {
  const counted = { guides: 7, organisations: 2, toys: 5 }
  it('counts a live number and states a pinned one, under the saved label', () => {
    const saved = {
      guides: { label: 'Guides published', live: true, pinned: 900, source: '' },
      toys: { label: 'Toys passed on', live: false, pinned: 40, source: 'Our 2025 count' },
    }
    expect(homeNumbers(saved, counted)).toEqual([
      { key: 'guides', label: 'Guides published', value: 7 },
      { key: 'organisations', label: 'organisations', value: 2 },
      { key: 'toys', label: 'Toys passed on', value: 40 },
    ])
  })
  it('counts a pinned number that has no value', () => {
    const saved = { guides: { label: 'Guides', live: false, pinned: null, source: '' } }
    expect(homeNumbers(saved, counted)[0].value).toBe(7)
  })
})

describe('homeScenes', () => {
  const scenes = [
    { place: 'At home', title: 'A child finds the toy.', body: 'b1' },
    { place: 'At the bench', title: 'A maker adapts it.', body: 'b2' },
  ]
  it('overrides each scene’s place and line by position, leaving the rest', () => {
    const out = homeScenes(scenes, { scenes: [{ title: 'In the lounge', line: '' }] })
    expect(out[0]).toEqual({ place: 'In the lounge', title: 'A child finds the toy.', body: 'b1' })
    expect(out[1]).toBe(scenes[1])
  })
  it('is the page’s scenes when nothing was saved', () => {
    expect(homeScenes(scenes, null)).toEqual(scenes)
  })
})

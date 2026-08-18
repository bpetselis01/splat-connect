import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SCAFFOLD_KEYS } from '@/lib/public-nav'
import RequestsPage from '@/app/get-involved/requests/page'
import DesignChallengesPage from '@/app/get-involved/design-challenges/page'
import AskAnExpertPage from '@/app/learn/ask-an-expert/page'
import NewsPage from '@/app/impact/news/page'
import EventsPage from '@/app/impact/events/page'
import MapPage from '@/app/impact/map/page'
import PartnersPage from '@/app/about/partners/page'
import SupportPage from '@/app/about/support/page'
import PrintingPage from '@/app/printing/page'

const pages = [
  RequestsPage, DesignChallengesPage, AskAnExpertPage, NewsPage,
  EventsPage, MapPage, PartnersPage, SupportPage, PrintingPage,
]

describe('scaffold pages', () => {
  it('covers every scaffold key declared in the nav model', () => {
    expect(pages).toHaveLength(SCAFFOLD_KEYS.length)
  })

  it.each(pages.map((P, i) => [i, P] as const))(
    'page %i explains the plan and offers to notify',
    (_i, Page) => {
      render(<Page />)
      expect(screen.getByText(/not built yet/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: /how it will work/i })).toBeInTheDocument()
    }
  )
})

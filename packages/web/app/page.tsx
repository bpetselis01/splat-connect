import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TutorialCard } from '@/components/tutorial-card'
import type { Tutorial } from '@splat-connect/types'

export default async function HomePage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tutorials')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(3)

  const featured = (data as Tutorial[]) ?? []

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16 px-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#1e3a5f] mb-4">
          Every child deserves to play.
        </h1>
        <p className="text-gray-600 max-w-xl mx-auto text-lg mb-8">
          Free, step-by-step guides for switch-adapting commercial toys so
          children with disabilities can join in.
        </p>
        <Link
          href="/library"
          className="inline-block bg-[#1e3a5f] text-white px-8 py-3 rounded-lg font-semibold text-sm hover:bg-[#16304f]"
        >
          Browse the library →
        </Link>
      </div>

      {/* Featured tutorials */}
      {featured.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Recent tutorials</h2>
            <Link
              href="/library"
              className="text-sm text-blue-600 hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {featured.map((t) => (
              <TutorialCard key={t.id} tutorial={t} />
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {[
          { icon: '🔍', title: 'Browse', desc: 'Find a tutorial for the toy your child loves.' },
          { icon: '🛒', title: 'Buy the parts', desc: 'Each tutorial lists exactly what you need with links to buy.' },
          { icon: '🎉', title: 'Adapt & play', desc: 'Follow the step-by-step PDF guide to make it work with a switch.' },
        ].map((step) => (
          <div key={step.title} className="bg-white rounded-xl border p-6">
            <div className="text-4xl mb-3">{step.icon}</div>
            <h3 className="font-bold mb-1">{step.title}</h3>
            <p className="text-sm text-gray-500">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

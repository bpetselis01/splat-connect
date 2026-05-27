/**
 * Tutorial Card Component
 * 
 * Displays a preview of a tutorial in card format (title, image, difficulty).
 * Used in library listings and search results.
 * 
 * Props:
 * - tutorial: Tutorial object from API
 * 
 * Features:
 * - Shows toy photo if available, otherwise placeholder emoji
 * - Clickable link to full tutorial details page (/tutorials/:id)
 * - Difficulty badge for quick visual reference
 * - Truncated title and description
 * - Hover animation for interactivity
 * 
 * Data flow:
 * 1. Parent component fetches tutorials from API
 * 2. Maps array of tutorials to TutorialCard components
 * 3. User clicks card → navigates to /tutorials/:id
 * 4. Detail page fetches full tutorial (parts, tools, contributors)
 * 
 * Related files:
 * - components/difficulty-badge.tsx: Renders difficulty badge
 * - lib/api-client.ts: Fetches tutorial data
 * - app/library/page.tsx: Lists all tutorials in cards
 * - app/tutorials/[id]/page.tsx: Tutorial detail page
 * - types/index.ts: Tutorial type definition
 */
import Link from 'next/link'
import Image from 'next/image'
import { DifficultyBadge } from './difficulty-badge'
import type { Tutorial } from '@splat-connect/types'

export function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  return (
    <Link
      href={`/tutorials/${tutorial.id}`}
      className="block border rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-white"
    >
      {tutorial.toy_photo_url ? (
        <div className="relative h-36 w-full">
          <Image
            src={tutorial.toy_photo_url}
            alt={tutorial.title}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="h-36 bg-blue-100 flex items-center justify-center text-4xl">
          🧸
        </div>
      )}
      <div className="p-3">
        <p className="font-bold text-sm truncate">{tutorial.title}</p>
        {tutorial.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {tutorial.description}
          </p>
        )}
        <div className="mt-2">
          <DifficultyBadge difficulty={tutorial.difficulty} />
        </div>
      </div>
    </Link>
  )
}

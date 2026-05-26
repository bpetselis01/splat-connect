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

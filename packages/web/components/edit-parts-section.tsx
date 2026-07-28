'use client'
import type { Part, BuyLink } from '@splat-connect/types'
import { EditItemsSection, type ItemInput } from '@/components/edit-items-section'

type PartInput = { name: string; quantity: number; is_optional: boolean; buy_links: BuyLink[] }

interface EditPartsSectionProps {
  initialParts: Part[]
  onSave: (parts: PartInput[]) => Promise<void>
}

export function EditPartsSection({ initialParts, onSave }: EditPartsSectionProps) {
  // withQuantity guarantees every ItemInput carries quantity, hence the cast.
  return (
    <EditItemsSection
      noun="part"
      withQuantity
      initialItems={initialParts}
      onSave={(items: ItemInput[]) => onSave(items as PartInput[])}
    />
  )
}

'use client'
import type { Tool, BuyLink } from '@splat-connect/types'
import { EditItemsSection } from '@/components/edit-items-section'

type ToolInput = { name: string; is_optional: boolean; buy_links: BuyLink[] }

interface EditToolsSectionProps {
  initialTools: Tool[]
  onSave: (tools: ToolInput[]) => Promise<void>
}

export function EditToolsSection({ initialTools, onSave }: EditToolsSectionProps) {
  return <EditItemsSection noun="tool" initialItems={initialTools} onSave={onSave} />
}

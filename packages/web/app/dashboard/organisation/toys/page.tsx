import { ComingSoon } from '@/components/coming-soon'

export default function OrgToyInventoryPage() {
  return (
    <ComingSoon
      label="Toy Inventory"
      description="The adapted toys your organisation holds. This list is public, so parents can find and request them."
      steps={[
        'Add the toys your organisation holds',
        'Mark each one available, lent out or reserved',
        'Accept exchange requests from parents',
      ]}
    />
  )
}

import { ComingSoon } from '@/components/coming-soon'

export default function MyToysPage() {
  return (
    <ComingSoon
      label="My Toys"
      description="The adapted toys you hold, ready to offer for exchange with an association."
      steps={[
        'Add a toy, with photos and what it was adapted for',
        'Offer it for exchange or keep it listed as yours',
        'Agree a swap with an association near you',
      ]}
    />
  )
}

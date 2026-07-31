import { ComingSoon } from '@/components/coming-soon'

export default function MyPrintRequestsPage() {
  return (
    <ComingSoon
      label="My Print Requests"
      description="The parts you have asked an association to print, and where each one has got to."
      steps={[
        'Request a part from an association with printers free',
        'Follow it from accepted through printed',
        'Arrange pickup when it is ready',
      ]}
    />
  )
}

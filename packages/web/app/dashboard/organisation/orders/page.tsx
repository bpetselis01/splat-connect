import { ComingSoon } from '@/components/coming-soon'

export default function OrgPrintOrdersPage() {
  return (
    <ComingSoon
      label="Print Orders"
      description="Print requests parents have sent your organisation, from first ask to pickup."
      steps={[
        'Review incoming requests and what each part needs',
        'Accept the ones your printers can take',
        'Mark them printed and ready for pickup',
      ]}
    />
  )
}

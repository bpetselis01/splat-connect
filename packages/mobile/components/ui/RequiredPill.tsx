// packages/mobile/components/ui/RequiredPill.tsx
import { theme } from '../../lib/theme'
import { Pill } from '../list/list-kit'

/** Marks a form question the person must answer. Optional ones carry no pill. */
export const RequiredPill = () => <Pill label="Required" bg={theme.colors.apricotSoft} />

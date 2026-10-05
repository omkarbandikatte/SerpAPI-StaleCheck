import { verdictLabel } from '@/lib/verdicts'
import type { VerdictLabel } from '@/lib/types'
export function VerdictBadge({ verdict }: { verdict: VerdictLabel }) { const meta = verdictLabel(verdict); const Icon = meta.icon; return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${meta.className}`}><Icon className="size-3.5" />{meta.label}</span> }

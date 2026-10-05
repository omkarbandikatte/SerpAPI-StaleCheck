import { CheckCircle2, Clock3, HelpCircle, XCircle } from 'lucide-react'
import type { VerdictLabel } from './types'
export const verdicts: Record<VerdictLabel, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  current: { label: 'Current', className: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2 },
  outdated: { label: 'Outdated', className: 'text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/30', icon: Clock3 },
  contradicted: { label: 'Contradicted', className: 'text-violet-700 dark:text-violet-300 bg-violet-500/10 border-violet-500/30', icon: XCircle },
  unverifiable: { label: 'Unverifiable', className: 'text-slate-700 dark:text-slate-300 bg-slate-500/10 border-slate-500/30', icon: HelpCircle },
}
export const verdictOrder: VerdictLabel[] = ['outdated', 'contradicted', 'unverifiable', 'current']
export const verdictLabel = (value: VerdictLabel) => verdicts[value]

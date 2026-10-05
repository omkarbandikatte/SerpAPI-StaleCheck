import type { Engine } from '@/lib/types'
export function EngineBadge({ engine }: { engine: Engine }) { return <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{engine === 'google_news' ? 'News' : engine === 'google_scholar' ? 'Scholar' : 'Google'}</span> }

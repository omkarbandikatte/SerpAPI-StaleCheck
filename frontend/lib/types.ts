export type ClaimType = 'office_holder' | 'statistic' | 'policy_scheme' | 'event_date' | 'ranking' | 'scientific'
export type VerdictLabel = 'current' | 'outdated' | 'contradicted' | 'unverifiable'
export type Engine = 'google' | 'google_news' | 'google_scholar'
export type Evidence = { url:string; title:string; source:string; domain:string; tier:1|2|3|4; date:string|null; snippet:string; engine:Engine }
export type Claim = { id:string; text:string; span:{start:number;end:number}; type:ClaimType; subject:string; value:string; verdict:VerdictLabel; confidence:'high'|'medium'|'low'; updated_value:string|null; changed_around:string|null; reasoning:string; evidence:Evidence[]; engines_used:Engine[] }
export type CheckStatus = { check_id:string; status:'queued'|'extracting'|'searching'|'verifying'|'done'|'failed'; progress:{done:number;total:number}; partial_claims:Claim[]; error?:string }
export type Report = { check_id:string; doc_title:string; doc_as_of:string; checked_at:string; document_text:string; freshness_score:number; counts:Record<VerdictLabel,number>; claims:Claim[]; searches_used:number }
export type CheckSummary = { check_id:string; title:string; doc_as_of:string; status:CheckStatus['status']; created_at:string; freshness_score:number; claim_count:number }

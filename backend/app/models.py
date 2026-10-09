from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ClaimType = Literal["office_holder", "statistic", "policy_scheme", "event_date", "ranking", "scientific"]
VerdictLabel = Literal["current", "outdated", "contradicted", "unverifiable"]
Engine = Literal["google", "google_news", "google_scholar"]
Confidence = Literal["high", "medium", "low"]
Status = Literal["queued", "extracting", "searching", "verifying", "done", "failed"]

class Span(BaseModel):
    start: int = Field(..., description="Start index of the span")
    end: int = Field(..., description="End index of the span")


class Evidence(BaseModel):
    url: str
    title: str
    source: str
    domain: str
    tier: Literal[1, 2, 3, 4]
    date: str | None = None
    snippet: str
    engine: Engine


class Claim(BaseModel):
    id: str
    text: str
    span: Span
    type: ClaimType
    subject: str
    value: str
    verdict: VerdictLabel
    confidence: Confidence
    updated_value: str | None = None
    changed_around: str | None = None
    reasoning: str
    evidence: list[Evidence] = Field(default_factory=list)
    engines_used: list[Engine] = Field(default_factory=list)


class Progress(BaseModel):
    done: int = 0
    total: int = 0


class CheckStatus(BaseModel):
    check_id: str
    status: Status
    progress: Progress = Field(default_factory=Progress)
    partial_claims: list[Claim] = Field(default_factory=list)
    error: str | None = None


class Report(BaseModel):
    check_id: str
    doc_title: str
    doc_as_of: str
    checked_at: str
    document_text: str
    freshness_score: int = Field(ge=0, le=100)
    counts: dict[VerdictLabel, int]
    claims: list[Claim]
    searches_used: int = Field(ge=0)


class CheckCreated(BaseModel):
    check_id: str


class CheckSummary(BaseModel):
    check_id: str
    title: str
    owner_name: str
    doc_as_of: str
    status: Status
    created_at: datetime
    freshness_score: int
    claim_count: int

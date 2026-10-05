import asyncio
import json
import logging
import re
from collections import Counter
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

import httpx

from . import config
from .models import Claim, Confidence, Engine, Evidence, Report, Span, VerdictLabel
from .store import PostgresStore

ENGINES: tuple[Engine, ...] = ("google", "google_news", "google_scholar")
CLAIM_TYPES = {"office_holder", "statistic", "policy_scheme", "event_date", "ranking", "scientific"}
VERDICTS = {"current", "outdated", "contradicted", "unverifiable"}
logger = logging.getLogger(__name__)
CONFIDENCES = {"high", "medium", "low"}


def extract_pdf(data: bytes) -> str:
    import pymupdf

    with pymupdf.open(stream=data, filetype="pdf") as document:
        return "\n\n".join(page.get_text("text").strip() for page in document if page.get_text("text").strip())


async def run_check(
    store: PostgresStore,
    check_id: str,
    user_id: UUID,
    title: str,
    doc_as_of: str,
    document: str | bytes,
) -> None:
    try:
        await _set_status(store, check_id, "extracting")
        if isinstance(document, bytes):
            text = await asyncio.to_thread(extract_pdf, document)
        else:
            text = document
        text = _normalize_text(text)
        if not text:
            raise ValueError("The document does not contain extractable text.")
        if len(text) > config.MAX_DOCUMENT_CHARS:
            raise ValueError(f"The document exceeds the {config.MAX_DOCUMENT_CHARS:,}-character limit.")

        extracted = await _extract_claims(text, doc_as_of)
        await _set_status(store, check_id, "searching", total=len(extracted))

        claims: list[Claim] = []
        searches_used = 0
        semaphore = asyncio.Semaphore(2)
        evidence_semaphore = asyncio.Semaphore(2)
        evidence_tasks: list[asyncio.Task[None]] = []

        async def process_claim(index: int, raw_claim: dict[str, str | int]) -> tuple[Claim, int]:
            async with semaphore:
                search_task = asyncio.create_task(_search_claim(raw_claim, doc_as_of))
                claim_embedding = (await _embed_contents([str(raw_claim["text"])]))[0]
                prior_evidence = await asyncio.to_thread(
                    store.retrieve_evidence,
                    user_id,
                    check_id,
                    claim_embedding,
                )
                evidence, search_count = await search_task
                claim = await _verify_claim(index, raw_claim, evidence, prior_evidence, doc_as_of)
                return claim, search_count

        async def persist_evidence(claim: Claim) -> None:
            async with evidence_semaphore:
                await _store_evidence(store, check_id, user_id, claim)

        tasks = [
            asyncio.create_task(process_claim(index, raw_claim))
            for index, raw_claim in enumerate(extracted, start=1)
        ]
        for completed in asyncio.as_completed(tasks):
            claim, search_count = await completed
            claims.append(claim)
            claims.sort(key=lambda item: int(item.id.removeprefix("claim-")))
            searches_used += search_count
            evidence_tasks.append(asyncio.create_task(persist_evidence(claim)))
            await _set_status(
                store,
                check_id,
                "verifying",
                done=len(claims),
                total=len(extracted),
                claims=claims,
            )

            await asyncio.gather(*evidence_tasks)

        report = _build_report(check_id, title, doc_as_of, text, claims, searches_used)
        await asyncio.to_thread(store.save_report, report)
        await _set_status(store, check_id, "done", done=len(claims), total=len(claims), claims=claims)
    except Exception as error:
        logger.exception("Check %s failed", check_id)
        await _set_status(store, check_id, "failed", error=_public_error(error))


async def _extract_claims(text: str, doc_as_of: str) -> list[dict[str, str | int]]:
    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    base_prompt = f"""Extract independently checkable, time-sensitive factual claims from the document below.
The document date is {doc_as_of}. Return JSON as an object with a `claims` array. Each item must contain:
- text: an exact, contiguous substring copied from the document
- type: one of office_holder, statistic, policy_scheme, event_date, ranking, scientific
- subject: the entity or topic being asserted
- value: the asserted value, person, date, rank, or finding
For documents longer than 2,000 characters, return 8 to 20 substantive claims distributed across the document.
Never use a title, issue/update date label, page number, header, footer, or citation as a claim.
Prefer statements about current policy, eligibility, requirements, statistics, named programs, and dated events.
Ignore opinions, predictions, and timeless definitions.

DOCUMENT:
{text}
"""
    minimum_claims = 8 if len(text) > 2_000 else 1
    claims: list[dict[str, str | int]] = []
    for attempt in range(2):
        correction = ""
        if attempt:
            correction = (
                f"Your previous extraction yielded only {len(claims)} valid claims. "
                f"A response with fewer than {minimum_claims} claims is invalid. "
                "Cover substantive statements throughout the document, then return the complete JSON object.\n\n"
            )
        response = await _gemini_json(correction + base_prompt)
        candidates = response.get("claims", [])
        if not isinstance(candidates, list):
            raise ValueError("Gemini returned an invalid claim list.")
        claims = _parse_claim_candidates(text, candidates)
        if len(claims) >= minimum_claims:
            break
    return claims


def _parse_claim_candidates(text: str, candidates: list[object]) -> list[dict[str, str | int]]:
    claims: list[dict[str, str | int]] = []
    cursor = 0
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        claim_text = str(candidate.get("text", "")).strip()
        claim_type = str(candidate.get("type", ""))
        start = text.find(claim_text, cursor)
        if start < 0:
            start = text.find(claim_text)
        if not claim_text or start < 0 or claim_type not in CLAIM_TYPES:
            continue
        claims.append(
            {
                "text": claim_text,
                "type": claim_type,
                "subject": str(candidate.get("subject", "")).strip() or claim_text,
                "value": str(candidate.get("value", "")).strip() or claim_text,
                "start": start,
                "end": start + len(claim_text),
            }
        )
        cursor = start + len(claim_text)
    return claims


async def _search_claim(raw_claim: dict[str, str | int], doc_as_of: str) -> tuple[list[Evidence], int]:
    if not config.SERPAPI_API_KEY:
        raise RuntimeError("SERPAPI_API_KEY is not configured.")
    query = f'"{raw_claim["subject"]}" {raw_claim["value"]} after:{doc_as_of}'
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        results = await asyncio.gather(
            *[_search_engine(client, engine, query) for engine in ENGINES],
            return_exceptions=True,
        )
    evidence: list[Evidence] = []
    successful_searches = 0
    for engine, result in zip(ENGINES, results, strict=True):
        if isinstance(result, Exception):
            continue
        successful_searches += 1
        evidence.extend(_parse_search_results(engine, result))
    if not successful_searches:
        raise RuntimeError("All SerpAPI searches failed. Check the API key and quota.")
    return evidence, successful_searches


async def _search_engine(client: httpx.AsyncClient, engine: Engine, query: str) -> dict[str, Any]:
    parameters: dict[str, str | int] = {
        "api_key": config.SERPAPI_API_KEY or "",
        "engine": engine,
        "q": query,
        "num": config.SERPAPI_RESULTS_PER_ENGINE,
    }
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            response = await client.get("https://serpapi.com/search.json", params=parameters)
            response.raise_for_status()
            payload = response.json()
            if payload.get("error"):
                raise RuntimeError(str(payload["error"]))
            return payload
        except (httpx.HTTPError, RuntimeError) as error:
            last_error = error
            if attempt == 0:
                await asyncio.sleep(0.5)
    raise RuntimeError(f"{engine} search failed after retry.") from last_error


def _parse_search_results(engine: Engine, payload: dict[str, Any]) -> list[Evidence]:
    items = payload.get("organic_results") or payload.get("news_results") or []
    evidence: list[Evidence] = []
    for item in items[: config.SERPAPI_RESULTS_PER_ENGINE]:
        url = str(item.get("link") or item.get("url") or "")
        if not url:
            continue
        domain = urlparse(url).netloc.removeprefix("www.")
        source = item.get("source")
        if isinstance(source, dict):
            source = source.get("name")
        evidence.append(
            Evidence(
                url=url,
                title=str(item.get("title") or domain),
                source=str(source or domain),
                domain=domain,
                tier=_source_tier(domain, engine),
                date=str(item.get("date")) if item.get("date") else None,
                snippet=str(item.get("snippet") or item.get("description") or ""),
                engine=engine,
            )
        )
    return evidence


async def _verify_claim(
    index: int,
    raw_claim: dict[str, str | int],
    evidence: list[Evidence],
    prior_evidence: list[dict[str, object]],
    doc_as_of: str,
) -> Claim:
    evidence_payload = [item.model_dump(mode="json") for item in evidence]
    prompt = f"""Fact-check the claim using only the supplied search evidence and its dates.
The source document was written on {doc_as_of}; newer evidence matters most.
Claim: {raw_claim['text']}
Evidence: {json.dumps(evidence_payload, ensure_ascii=False)}
Prior evidence retrieved from this user's earlier checks: {json.dumps(prior_evidence, ensure_ascii=False, default=str)}

Return one JSON object with:
- verdict: current, outdated, contradicted, or unverifiable
- confidence: high, medium, or low
- updated_value: corrected current value or null
- changed_around: concise date/period when it changed or null
- reasoning: one concise sentence grounded in the evidence
Use unverifiable when evidence is weak, conflicting, absent, or does not directly establish the claim.
Treat prior evidence as supplemental context only. Base the verdict on the current live search evidence.
"""
    result = await _gemini_json(prompt)
    verdict = str(result.get("verdict", "unverifiable"))
    confidence = str(result.get("confidence", "low"))
    if verdict not in VERDICTS:
        verdict = "unverifiable"
    if confidence not in CONFIDENCES:
        confidence = "low"
    return Claim(
        id=f"claim-{index}",
        text=str(raw_claim["text"]),
        span=Span(start=int(raw_claim["start"]), end=int(raw_claim["end"])),
        type=str(raw_claim["type"]),
        subject=str(raw_claim["subject"]),
        value=str(raw_claim["value"]),
        verdict=verdict,
        confidence=confidence,
        updated_value=_optional_string(result.get("updated_value")),
        changed_around=_optional_string(result.get("changed_around")),
        reasoning=str(result.get("reasoning") or "The available evidence is insufficient to verify this claim."),
        evidence=evidence,
        engines_used=list(dict.fromkeys(item.engine for item in evidence)),
    )


async def _embed_contents(contents: list[str]) -> list[list[float]]:
    from google import genai

    def embed() -> list[list[float]]:
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        response = client.models.embed_content(
            model=config.GEMINI_EMBEDDING_MODEL,
            contents=contents,
            config={"output_dimensionality": 768},
        )
        return [list(item.values or []) for item in response.embeddings or []]

    embeddings = await asyncio.to_thread(embed)
    if len(embeddings) != len(contents) or any(len(item) != 768 for item in embeddings):
        raise RuntimeError("Gemini returned an invalid embedding response.")
    return embeddings


async def _store_evidence(store: PostgresStore, check_id: str, user_id: UUID, claim: Claim) -> None:
    evidence = [item for item in claim.evidence if item.snippet.strip()]
    if not evidence:
        return
    contents = [f"{item.title}\n{item.snippet}" for item in evidence]
    embeddings = await _embed_contents(contents)
    records = [
        (
            content,
            item.url,
            {
                "title": item.title,
                "source": item.source,
                "date": item.date,
                "tier": item.tier,
                "engine": item.engine,
                "claim": claim.text,
            },
            embedding,
        )
        for item, content, embedding in zip(evidence, contents, embeddings, strict=True)
    ]
    await asyncio.to_thread(store.save_evidence, check_id, user_id, claim.id, records)


async def _gemini_json(prompt: str) -> dict[str, Any]:
    from google import genai
    from google.genai import errors
    from google.genai import types
    from json_repair import repair_json

    def generate() -> str:
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        models = list(dict.fromkeys((config.GEMINI_MODEL, config.GEMINI_FALLBACK_MODEL)))
        for index, model in enumerate(models):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1),
                )
                if not response.text:
                    raise RuntimeError("Gemini returned an empty response.")
                return response.text
            except errors.APIError as error:
                retriable = error.code in {404, 429} or error.code >= 500
                if not retriable or index == len(models) - 1:
                    raise
        raise RuntimeError("No Gemini model is configured.")

    raw = await asyncio.to_thread(generate)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = repair_json(raw, return_objects=True)
    if isinstance(parsed, list) and len(parsed) == 1 and isinstance(parsed[0], dict):
        parsed = parsed[0]
    if not isinstance(parsed, dict):
        raise ValueError("Gemini returned an invalid JSON value.")
    return parsed


async def _set_status(
    store: PostgresStore,
    check_id: str,
    state: str,
    *,
    done: int = 0,
    total: int = 0,
    claims: list[Claim] | None = None,
    error: str | None = None,
) -> None:
    from .models import CheckStatus, Progress

    await asyncio.to_thread(
        store.save_status,
        CheckStatus(
            check_id=check_id,
            status=state,
            progress=Progress(done=done, total=total),
            partial_claims=claims or [],
            error=error,
        ),
    )


def _build_report(
    check_id: str,
    title: str,
    doc_as_of: str,
    text: str,
    claims: list[Claim],
    searches_used: int,
) -> Report:
    counts = Counter(claim.verdict for claim in claims)
    weights = {"current": 100, "outdated": 55, "contradicted": 15, "unverifiable": 35}
    score = round(sum(weights[claim.verdict] for claim in claims) / len(claims)) if claims else 100
    return Report(
        check_id=check_id,
        doc_title=title,
        doc_as_of=doc_as_of,
        checked_at=datetime.now(UTC).isoformat(),
        document_text=text,
        freshness_score=score,
        counts={label: counts[label] for label in ("current", "outdated", "contradicted", "unverifiable")},
        claims=claims,
        searches_used=searches_used,
    )


def _source_tier(domain: str, engine: Engine) -> int:
    if domain.endswith((".gov", ".gov.uk", ".gov.in", ".edu")):
        return 1
    if engine == "google_scholar" or domain.endswith(("nature.com", "science.org", "reuters.com", "apnews.com")):
        return 2
    return 3


def _normalize_text(text: str) -> str:
    return re.sub(r"[ \t]+", " ", re.sub(r"\r\n?", "\n", text)).strip()


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    result = str(value).strip()
    return result if result and result.lower() != "null" else None


def _public_error(error: Exception) -> str:
    if isinstance(error, (ValueError, RuntimeError)):
        return str(error)
    return "The check failed unexpectedly. Please try again."
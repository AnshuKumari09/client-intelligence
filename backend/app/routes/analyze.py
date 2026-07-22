from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.llm import analyze_transcript, LLMError
from app.services.parser import parse_llm_output, ParseError
from app.services.validator import validate_report

router = APIRouter()


class AnalyzeRequest(BaseModel):
    transcript: str


class AnalyzeResponse(BaseModel):
    status: str                       # "ok" | "parse_error" | "validation_error" | "llm_error"
    report: dict | None = None
    grounding_issues: list[dict] = []
    plausibility_issues: list[dict] = []
    schema_errors: list[str] = []
    error_message: str | None = None
    raw_model_output: str | None = None   # only populated on failure, for debugging
    meta: dict = {}


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """
    Pipeline: transcript -> LLM call -> JSON parse -> schema+grounding validation.

    Every stage can fail independently, and each failure mode gets a distinct
    status so the frontend (and the human debugging this) knows exactly where
    it broke:
      - "llm_error"        -> API/auth/network problem, nothing was generated
      - "parse_error"      -> model didn't return valid JSON (often a token-limit
                              truncation) — raw output is returned for inspection
      - "validation_error" -> JSON was valid but violated the schema or business
                              rules (e.g. ai_inference with no reason)
      - "ok"                -> passed both stages; grounding_issues may still be
                              non-empty (report is usable but flagged for review)
    """
    # Stage 1: call the LLM
    try:
        llm_result = analyze_transcript(req.transcript)
    except LLMError as e:
        return AnalyzeResponse(status="llm_error", error_message=str(e))

    # Stage 2: parse raw text into JSON
    try:
        parsed = parse_llm_output(llm_result.raw_text)
    except ParseError as e:
        return AnalyzeResponse(
            status="parse_error",
            error_message=str(e),
            raw_model_output=e.raw_text,
            meta={
                "stop_reason": llm_result.stop_reason,
                "output_tokens": llm_result.output_tokens,
            },
        )

    # Stage 3: schema + evidence-grounding validation
    result = validate_report(parsed.data, source_transcript=req.transcript)
    if not result.ok:
        return AnalyzeResponse(
            status="validation_error",
            schema_errors=result.schema_errors,
            raw_model_output=llm_result.raw_text,
            meta={"was_recovered_from_raw_text": parsed.was_recovered},
        )

    return AnalyzeResponse(
        status="ok",
        report=result.report.model_dump(),
        grounding_issues=[gi.__dict__ for gi in result.grounding_issues],
        plausibility_issues=[pi.__dict__ for pi in result.plausibility_issues],
        meta={
            "stop_reason": llm_result.stop_reason,
            "input_tokens": llm_result.input_tokens,
            "output_tokens": llm_result.output_tokens,
            "was_recovered_from_raw_text": parsed.was_recovered,
            "recovery_note": parsed.recovery_note,
        },
    )

"""
validator.py — semantic validation layer, sitting after parser.py.

Two jobs:
1. Schema validation: does the parsed dict actually satisfy ClientIntelligenceReport
   (pydantic model in schemas/response_schema.py)? This catches structural problems
   AND the business rules baked into the model (ai_inference needs a reason,
   missing_information can't carry a value/evidence).
2. Evidence grounding check: for every finding with evidence, do the quoted strings
   actually appear (near-verbatim) in the source transcript? This is a second,
   independent line of defense against hallucinated quotes — the model could
   satisfy pydantic's shape rules while still fabricating a quote, so we check
   the quote text itself against the real transcript.

This file never silently "fixes" bad data by guessing — it flags it. Fixing is a
human decision (Approve/Edit/Reject in the UI), not something this layer should
do quietly.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from app.schemas.response_schema import ClientIntelligenceReport


@dataclass
class GroundingIssue:
    path: str            # e.g. "domains.sleep.daily_log[3].finding.evidence[0]"
    day: str
    speaker: str
    quote: str
    reason: str          # why this quote is flagged


@dataclass
class PlausibilityIssue:
    path: str
    value: Any
    reason: str


@dataclass
class ValidationResult:
    ok: bool
    report: ClientIntelligenceReport | None
    schema_errors: list[str] = field(default_factory=list)
    grounding_issues: list[GroundingIssue] = field(default_factory=list)
    plausibility_issues: list[PlausibilityIssue] = field(default_factory=list)


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()


def _quote_is_grounded(quote: str, transcript: str) -> bool:
    """
    Fuzzy substring check: normalizes punctuation/case, then checks the quote's
    words appear contiguously (allowing minor gaps) in the transcript. This is a
    prototype-grade check, not a production NLP matcher — good enough to catch
    outright fabricated quotes, which is the failure mode we care about here.
    """
    norm_quote = _normalize(quote)
    norm_transcript = _normalize(transcript)
    if not norm_quote:
        return False
    if norm_quote in norm_transcript:
        return True
    # allow the quote's words to match with the transcript loosely (order-preserving,
    # small gaps allowed) in case of minor whitespace/punctuation differences
    words = norm_quote.split()
    if len(words) < 3:
        return norm_quote in norm_transcript
    pattern = r"\W+".join(re.escape(w) for w in words)
    return re.search(pattern, norm_transcript) is not None


def _extract_number(value: Any) -> float | None:
    """Pulls the first numeric token out of a value that may be '5 hours', 7000, '4,500 steps', etc."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    match = re.search(r"[\d,]+(?:\.\d+)?", str(value))
    if not match:
        return None
    return float(match.group(0).replace(",", ""))


# (path, plausible min, plausible max, unit) — deliberately generous ceilings;
# this catches unit-confusion (e.g. a step count of 7000 mistakenly reported as
# "average sleep hours") rather than flagging genuinely unusual-but-real values.
_PLAUSIBILITY_RULES = [
    ("domains.sleep.avg_hours", 0, 24, "hours"),
    ("domains.exercise_steps.avg_steps", 0, 40000, "steps"),
]


def _get_nested(data: dict[str, Any], dotted_path: str) -> Any:
    node = data
    for part in dotted_path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


def check_plausibility(data: dict[str, Any]) -> list[PlausibilityIssue]:
    issues: list[PlausibilityIssue] = []

    for path, lo, hi, unit in _PLAUSIBILITY_RULES:
        finding = _get_nested(data, path)
        if not isinstance(finding, dict):
            continue
        num = _extract_number(finding.get("value"))
        if num is not None and not (lo <= num <= hi):
            issues.append(
                PlausibilityIssue(
                    path=path,
                    value=finding.get("value"),
                    reason=f"Value {finding.get('value')!r} is outside a plausible range for "
                    f"{unit} ({lo}-{hi}) — likely a unit-confusion error (e.g. a step count "
                    f"reported under an hours field).",
                )
            )

    # daily_log entries for sleep (hours), steps, and water (litres), checked the same way
    daily_rules = [
        ("domains.sleep.daily_log", 0, 24, "hours"),
        ("domains.exercise_steps.daily_log", 0, 40000, "steps"),
        ("domains.water_intake.daily_log", 0, 15, "litres"),
    ]
    for path, lo, hi, unit in daily_rules:
        entries = _get_nested(data, path)
        if not isinstance(entries, list):
            continue
        for i, entry in enumerate(entries):
            finding = (entry or {}).get("finding") if isinstance(entry, dict) else None
            if not isinstance(finding, dict):
                continue
            num = _extract_number(finding.get("value"))
            if num is not None and not (lo <= num <= hi):
                issues.append(
                    PlausibilityIssue(
                        path=f"{path}[{i}].finding",
                        value=finding.get("value"),
                        reason=f"Value {finding.get('value')!r} on {entry.get('day', '?')} is outside "
                        f"a plausible range for {unit} ({lo}-{hi}) — likely a unit-confusion error.",
                    )
                )

    return issues


def _walk_findings(data: dict[str, Any]):
    """Yields (path, finding_dict) for every finding-shaped object in the parsed report."""

    def finding_like(d):
        return isinstance(d, dict) and "classification" in d and "evidence" in d

    def recurse(node, path):
        if isinstance(node, dict):
            if finding_like(node):
                yield path, node
            for k, v in node.items():
                yield from recurse(v, f"{path}.{k}")
        elif isinstance(node, list):
            for i, item in enumerate(node):
                yield from recurse(item, f"{path}[{i}]")

    yield from recurse(data, "root")


def validate_report(data: dict[str, Any], source_transcript: str) -> ValidationResult:
    # --- Stage 1: schema / business-rule validation via pydantic ---
    try:
        report = ClientIntelligenceReport.model_validate(data)
    except ValidationError as e:
        errors = [f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors()]
        return ValidationResult(ok=False, report=None, schema_errors=errors)

    # --- Stage 2: evidence grounding check against the actual transcript ---
    grounding_issues: list[GroundingIssue] = []
    for path, finding in _walk_findings(data):
        for i, ev in enumerate(finding.get("evidence", []) or []):
            quote = ev.get("quote", "")
            if not quote:
                continue
            if not _quote_is_grounded(quote, source_transcript):
                grounding_issues.append(
                    GroundingIssue(
                        path=f"{path}.evidence[{i}]",
                        day=ev.get("day", ""),
                        speaker=ev.get("speaker", ""),
                        quote=quote,
                        reason="Quote not found (even fuzzily) in the source transcript — possible fabrication.",
                    )
                )

    return ValidationResult(
        ok=True,
        report=report,
        schema_errors=[],
        grounding_issues=grounding_issues,
        plausibility_issues=check_plausibility(data),
    )

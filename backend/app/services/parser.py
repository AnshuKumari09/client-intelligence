"""
parser.py

Converts raw LLM output (Gemini/OpenAI/Claude) into a Python dictionary.

This module is model-agnostic:
- It only parses JSON.
- It does not validate business rules.
- It does not depend on any specific LLM provider.

Responsibilities:
1. Parse raw model output.
2. Remove markdown code fences if present.
3. Recover JSON from surrounding text when possible.
4. Raise ParseError if valid JSON cannot be recovered.
"""

from __future__ import annotations
import json
import re
from dataclasses import dataclass
from typing import Any, Optional


class ParseError(Exception):
    """Raised when raw model output cannot be turned into a JSON object at all."""
    def __init__(self, message: str, raw_text: str):
        super().__init__(message)
        self.raw_text = raw_text


@dataclass
class ParseResult:
    data: dict[str, Any]
    was_recovered: bool  # True if we had to strip fences / repair before parsing
    recovery_note: Optional[str] = None


def _strip_markdown_fences(text: str) -> str:
    """Removes ```json / ``` fences the model sometimes adds despite instructions."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _extract_first_json_object(text: str) -> Optional[str]:
    """
    Last-resort recovery: find the first balanced {...} block in the text,
    in case the model added stray prose before/after the JSON despite instructions.
    Uses brace counting rather than regex, since JSON can nest arbitrarily deep.
    """
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None  # unbalanced — truncated output, likely a token-limit cutoff


def parse_llm_output(raw_text: str) -> ParseResult:
    """
    Attempts, in order:
      1. Direct json.loads on the raw text (ideal path — model followed instructions).
      2. Strip markdown fences, then json.loads.
      3. Extract the first balanced {...} block, then json.loads.
    Raises ParseError with the original raw_text attached if all three fail —
    callers (routes/analyze.py) surface raw_text to the client so nothing is
    silently swallowed.
    """
    # Attempt 1
    try:
        return ParseResult(data=json.loads(raw_text), was_recovered=False)
    except json.JSONDecodeError:
        pass

    # Attempt 2
    cleaned = _strip_markdown_fences(raw_text)
    try:
        return ParseResult(
            data=json.loads(cleaned),
            was_recovered=True,
            recovery_note="Stripped markdown code fences before parsing.",
        )
    except json.JSONDecodeError:
        pass

    # Attempt 3
    extracted = _extract_first_json_object(raw_text)
    if extracted:
        try:
            return ParseResult(
                data=json.loads(extracted),
                was_recovered=True,
                recovery_note="Extracted a balanced {...} block from surrounding text.",
            )
        except json.JSONDecodeError:
            pass

    raise ParseError(
        "Model output could not be parsed as JSON after fence-stripping and "
        "brace-extraction. Likely cause: output was truncated (token limit hit) "
        "mid-object, or the model wrote prose instead of JSON.",
        raw_text=raw_text,
    )

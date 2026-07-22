from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

MODEL_NAME = os.getenv(
    "GROQ_MODEL",
    "llama-3.3-70b-versatile",
)

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
_SCHEMAS_DIR = Path(__file__).resolve().parent.parent / "schemas"


def _load_system_prompt() -> str:
    base_prompt = (_PROMPTS_DIR / "system_prompt.md").read_text(encoding="utf-8")
    schema_json = (_SCHEMAS_DIR / "schema.json").read_text(encoding="utf-8")

    schema_compact = json.dumps(
        json.loads(schema_json),
        separators=(",", ":"),
    )

    return (
        base_prompt
        + "\n\nJSON SCHEMA (must validate exactly):\n"
        + schema_compact
    )


@dataclass
class LLMResult:
    raw_text: str
    stop_reason: str
    input_tokens: int
    output_tokens: int


class LLMError(Exception):
    pass


def get_client():
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise LLMError("GROQ_API_KEY is not set in .env")

    return Groq(api_key=api_key)


def analyze_transcript(transcript: str) -> LLMResult:
    client = get_client()

    system_prompt = _load_system_prompt()

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            temperature=0,
            response_format={
                "type":"json_object"
            },
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": f"TRANSCRIPT:\n{transcript}",
                },
            ],
        )

        raw_text = response.choices[0].message.content

        return LLMResult(
            raw_text=raw_text,
            stop_reason=response.choices[0].finish_reason or "completed",
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
        )

    except Exception as e:
        raise LLMError(f"Groq API call failed: {e}") from e
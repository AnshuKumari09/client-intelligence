# FUME Client Intelligence — Backend

FastAPI backend that analyzes a client-coach conversation transcript into
structured, evidence-grounded client intelligence (see `app/schemas/schema.json`).

## Setup
```
pip install -r requirements.txt
cp .env.example .env        # then paste your real GEMINI_API_KEY into .env
uvicorn app.main:app --reload --port 8420
```

## Endpoints
- `GET /health` -> `{"status": "ok"}`
- `POST /api/analyze` — body: `{"transcript": "Day 1\n..."}`
  - Response `status` is one of:
    - `ok` — validated report in `report`, any evidence-grounding concerns in `grounding_issues`
    - `llm_error` — API/auth/network problem, nothing was generated
    - `parse_error` — model didn't return valid JSON (often a token-limit truncation);
      raw text is in `raw_model_output` for inspection
    - `validation_error` — JSON was valid but broke the schema or a business rule
      (e.g. an `ai_inference` finding with no `reason`); raw text is in `raw_model_output`

## Architecture
```
app/
  main.py                     FastAPI app + CORS (for the React frontend)
  routes/analyze.py           /api/analyze — orchestrates the 3-stage pipeline
  services/llm.py             calls Gemini API, loads system prompt + schema
  services/parser.py          raw text -> JSON (handles fences, prose-wrapping, truncation)
  services/validator.py       JSON -> ClientIntelligenceReport (pydantic) + evidence grounding check
  prompts/system_prompt.md    the exact instructions sent to Claude
  schemas/schema.json         JSON schema shown to the model
  schemas/response_schema.py  pydantic models — code-level enforcement of the schema
```

Each stage of the pipeline fails independently and reports a distinct `status`,
so a broken response is always traceable to LLM call / JSON parsing / schema
validation — never a silent 200 with bad data.

## Tested so far (without a real API key)
- `response_schema.py`: rejects `ai_inference` with no `reason`, rejects
  `missing_information` carrying a value.
- `parser.py`: recovers from markdown fences and prose-wrapped JSON; raises
  `ParseError` (not a silent failure) on truncated/broken JSON.
- `validator.py`: flags a fabricated evidence quote that doesn't appear in the
  source transcript.
- Full `/api/analyze` pipeline: verified end-to-end with a mocked LLM response
  (see project notes) — routes, parsing, and validation are correctly wired.
- **Not yet tested**: a real call to the GEMINI_API_KE (needs your key in `.env`).

"""
Pydantic models mirroring schemas/schema.json.

Why this file exists (important for the interview):
The JSON schema is the *contract* we show the LLM. This file is the *enforcement* —
even if the LLM ignores an instruction, invalid data cannot pass through this layer.
validator.py uses these models to reject/repair bad output before it ever reaches
the frontend. Structure > prompting alone for hallucination control.
"""

from __future__ import annotations
from enum import Enum
from typing import List, Optional, Union
from pydantic import BaseModel, Field, model_validator


class Classification(str, Enum):
    confirmed_fact = "confirmed_fact"
    client_reported = "client_reported"
    ai_inference = "ai_inference"
    missing_information = "missing_information"


class Speaker(str, Enum):
    client = "Client"
    coach = "Coach"
    accountability_coach = "Accountability Coach"


class Evidence(BaseModel):
    day: str
    timestamp: Optional[str] = None
    speaker: Speaker
    quote: str = Field(..., description="Verbatim excerpt, should be <=15 words.")

    @model_validator(mode="after")
    def quote_not_too_long(self):
        # Soft guard, not a hard reject — validator.py decides what to do with the flag.
        if len(self.quote.split()) > 20:
            self.quote = self.quote  # left as-is; validator.py will flag this, not silently truncate
        return self


class Finding(BaseModel):
    value: Optional[Union[str, float, int]] = None
    classification: Classification
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence: List[Evidence] = Field(default_factory=list)
    reason: Optional[str] = None
    review_status: str = Field(default="pending")

    @model_validator(mode="after")
    def enforce_classification_rules(self):
        if self.classification == Classification.ai_inference and not (self.reason and self.reason.strip()):
            raise ValueError(
                "ai_inference finding is missing a 'reason' — every inference must state its logical chain."
            )
        if self.classification == Classification.missing_information:
            if self.value not in (None, "", "null"):
                raise ValueError(
                    "missing_information finding has a non-null value — model tried to guess a missing data point."
                )
            if self.evidence:
                raise ValueError(
                    "missing_information finding carries evidence — evidence implies the info was NOT missing."
                )
        if self.review_status not in ("pending", "approved", "edited", "rejected"):
            self.review_status = "pending"
        return self


class DayMetric(BaseModel):
    day: str
    finding: Finding


class NutritionAdherence(BaseModel):
    overall_rating: Optional[Finding] = None
    daily_log: List[DayMetric] = Field(default_factory=list)
    gaps_identified: List[Finding] = Field(default_factory=list)


class ExerciseSteps(BaseModel):
    daily_log: List[DayMetric] = Field(default_factory=list)
    avg_steps: Optional[Finding] = None
    exercise_types_mentioned: List[str] = Field(default_factory=list)


class Sleep(BaseModel):
    daily_log: List[DayMetric] = Field(default_factory=list)
    avg_hours: Optional[Finding] = None
    trend: Optional[Finding] = None


class WaterIntake(BaseModel):
    daily_log: List[DayMetric] = Field(default_factory=list)


class SymptomsStress(BaseModel):
    symptoms_reported: List[Finding] = Field(default_factory=list)
    stress_events: List[Finding] = Field(default_factory=list)


class Domains(BaseModel):
    nutrition_adherence: NutritionAdherence
    exercise_steps: ExerciseSteps
    sleep: Sleep
    water_intake: WaterIntake
    symptoms_stress: SymptomsStress


class Engagement(BaseModel):
    level: Optional[str] = None  # "high" | "moderate" | "low"
    finding: Optional[Finding] = None
    missed_checkins: List[Finding] = Field(default_factory=list)


class RiskFlag(BaseModel):
    flag: str
    severity: str  # "low" | "medium" | "high"
    finding: Finding


class RecommendedNextAction(BaseModel):
    action: str
    rationale: str
    classification: Classification
    confidence: float = Field(..., ge=0.0, le=1.0)


class Meta(BaseModel):
    client_id: Optional[str] = None
    period_covered: Optional[str] = None
    generated_at: Optional[str] = None
    review_status: str = Field(default="pending_review")


class WeeklySummary(BaseModel):
    text: str
    classification: Classification
    confidence: float = Field(..., ge=0.0, le=1.0)
    review_status: str = Field(default="pending")


class ClientIntelligenceReport(BaseModel):
    meta: Meta
    weekly_summary: WeeklySummary
    domains: Domains
    engagement: Engagement
    key_barriers: List[Finding] = Field(default_factory=list)
    pending_actions: List[Finding] = Field(default_factory=list)
    risk_flags: List[RiskFlag] = Field(default_factory=list)
    recommended_next_action: RecommendedNextAction

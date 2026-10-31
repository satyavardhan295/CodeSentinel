from collections import Counter
from dataclasses import dataclass
from typing import Protocol

# Points deducted per issue and the cap per severity
WEIGHTS = {"Critical": (18, 54), "High": (10, 40), "Medium": (4, 20), "Low": (1, 10)}
DEFAULT_POINTS = {"Critical": 16, "High": 10, "Medium": 5, "Low": 1}


class Scorable(Protocol):
    severity: str
    effort_hours: float


@dataclass
class ScanScore:
    score: int
    grade: str
    risk_level: str
    debt_hours: float


def grade_for(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def risk_for(critical: int, high: int) -> str:
    if critical >= 3:
        return "Critical"
    if critical >= 1:
        return "High"
    if high >= 3:
        return "Medium"
    return "Low"


def points_if_fixed(severity: str, points: int | None) -> int:
    """Use Gemini's estimate when it gave one (1-20), else the severity default."""
    if points and points > 0:
        return min(points, 20)
    return DEFAULT_POINTS.get(severity, 1)


def calculate_score(findings: list[Scorable]) -> ScanScore:
    counts = Counter(f.severity for f in findings)
    deductions = sum(
        min(counts.get(sev, 0) * per_issue, cap) for sev, (per_issue, cap) in WEIGHTS.items()
    )
    score = max(0, 100 - deductions)
    return ScanScore(
        score=score,
        grade=grade_for(score),
        risk_level=risk_for(counts.get("Critical", 0), counts.get("High", 0)),
        debt_hours=round(sum(f.effort_hours or 0 for f in findings), 1),
    )

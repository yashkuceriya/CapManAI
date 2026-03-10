"""MTSS (Multi-Tier System of Supports) classification engine."""
from typing import Optional


class MTSSEngine:
    """Classifies students into support tiers based on objective-level mastery."""

    TIER_THRESHOLDS = {
        "tier1": {"label": "On Track", "min_mastery": 75, "description": "Mastery ≥ 75% across all core objectives"},
        "tier2": {"label": "Targeted Support", "min_mastery": 50, "description": "Mastery 50-74% in 1+ objectives"},
        "tier3": {"label": "Intensive Support", "min_mastery": 0, "description": "Mastery < 50% in 2+ objectives"},
    }

    def classify_student(self, objective_progress: list[dict]) -> dict:
        """Classify a student into an MTSS tier based on their objective mastery."""
        if not objective_progress:
            return {
                "tier": "tier3",
                "tier_label": "Intensive Support",
                "reason": "No assessment data available",
                "weak_objectives": [],
                "strong_objectives": [],
            }

        scores = {}
        for op in objective_progress:
            scores[op.get("objective_id", op.get("id", "unknown"))] = op.get("mastery_score", 0)

        below_50 = [obj_id for obj_id, score in scores.items() if score < 50]
        below_75 = [obj_id for obj_id, score in scores.items() if score < 75]
        above_75 = [obj_id for obj_id, score in scores.items() if score >= 75]
        above_85 = [obj_id for obj_id, score in scores.items() if score >= 85]

        # Classification logic
        if len(below_50) >= 2:
            tier = "tier3"
            tier_label = "Intensive Support"
            reason = f"Mastery below 50% in {len(below_50)} objectives: {', '.join(below_50)}"
        elif len(below_75) >= 1:
            tier = "tier2"
            tier_label = "Targeted Support"
            reason = f"Mastery below 75% in: {', '.join(below_75)}"
        else:
            tier = "tier1"
            tier_label = "On Track"
            reason = "All objectives at 75%+ mastery"

        return {
            "tier": tier,
            "tier_label": tier_label,
            "reason": reason,
            "weak_objectives": below_75,
            "strong_objectives": above_75,
            "critical_objectives": below_50,
            "mastery_scores": scores,
        }

    def update_objective_mastery(
        self,
        current_score: float,
        recent_scores: list[float],
        new_score: float,
        decay_weight: float = 0.3,
    ) -> dict:
        """Update rolling mastery score with recency weighting."""
        # Keep last 10 scores
        updated_scores = (recent_scores or [])[-9:] + [new_score]

        # Weighted average: recent scores count more
        if len(updated_scores) == 1:
            new_mastery = new_score
        else:
            weights = []
            for i in range(len(updated_scores)):
                # Exponential decay: more recent = higher weight
                weight = (1 - decay_weight) ** (len(updated_scores) - 1 - i)
                weights.append(weight)

            total_weight = sum(weights)
            new_mastery = sum(s * w for s, w in zip(updated_scores, weights)) / total_weight

        # Determine trend
        if len(updated_scores) >= 3:
            recent_avg = sum(updated_scores[-3:]) / 3
            older_avg = sum(updated_scores[:-3]) / max(1, len(updated_scores) - 3) if len(updated_scores) > 3 else recent_avg

            if recent_avg > older_avg + 5:
                trend = "improving"
            elif recent_avg < older_avg - 5:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"

        return {
            "mastery_score": round(new_mastery, 1),
            "recent_scores": updated_scores,
            "trend": trend,
        }

    def get_recommended_objectives(self, objective_progress: list[dict], max_recommendations: int = 3) -> list[str]:
        """Recommend which objectives to focus on next (weakest first)."""
        if not objective_progress:
            return ["trade_thesis", "strike_selection", "risk_management"]

        # Sort by mastery score ascending (weakest first)
        sorted_objectives = sorted(objective_progress, key=lambda x: x.get("mastery_score", 0))

        return [op.get("objective_id", op.get("id")) for op in sorted_objectives[:max_recommendations]]

    def generate_tier_transition_alert(
        self, user_id: str, username: str, old_tier: str, new_tier: str, reason: str
    ) -> Optional[dict]:
        """Generate an alert if a student changes tiers."""
        if old_tier == new_tier:
            return None

        tier_order = {"tier1": 1, "tier2": 2, "tier3": 3}
        direction = "improved" if tier_order.get(new_tier, 3) < tier_order.get(old_tier, 3) else "declined"

        return {
            "type": "tier_transition",
            "user_id": user_id,
            "username": username,
            "old_tier": old_tier,
            "new_tier": new_tier,
            "direction": direction,
            "reason": reason,
            "action_needed": direction == "declined",
        }

"""Tests for the RAG (Retrieval-Augmented Generation) service."""
from app.services.rag import CapManRAG, get_rag, _KEYWORD_SECTIONS


class TestRAGKeywordMapping:
    def test_keyword_sections_not_empty(self):
        assert len(_KEYWORD_SECTIONS) > 0

    def test_all_values_are_lists(self):
        for key, val in _KEYWORD_SECTIONS.items():
            assert isinstance(val, list), f"Key '{key}' maps to {type(val)}, expected list"

    def test_known_regime_keys_exist(self):
        for regime in ["bullish", "bearish", "neutral", "high_iv", "low_iv", "earnings"]:
            assert regime in _KEYWORD_SECTIONS

    def test_known_objective_keys_exist(self):
        for obj in ["trade_thesis", "strike_selection", "risk_management", "greeks_understanding"]:
            assert obj in _KEYWORD_SECTIONS


class TestRAGRetrieval:
    def test_singleton_pattern(self):
        rag1 = get_rag()
        rag2 = get_rag()
        assert rag1 is rag2

    def test_retrieve_for_scenario_returns_string(self):
        rag = get_rag()
        result = rag.retrieve_for_scenario("bullish", ["trade_thesis"])
        assert isinstance(result, str)

    def test_retrieve_for_grading_returns_string(self):
        rag = get_rag()
        result = rag.retrieve_for_grading(
            scenario_context="bullish market with high IV",
            student_response="I would sell a put spread",
        )
        assert isinstance(result, str)

    def test_retrieve_respects_max_chars(self):
        rag = get_rag()
        result = rag._find_sections(["bullish", "bearish", "neutral"], max_chars=500)
        assert len(result) <= 600  # small buffer for joining

    def test_unknown_keyword_returns_empty_or_fallback(self):
        rag = get_rag()
        result = rag._find_sections(["completely_unknown_keyword_xyz"])
        assert isinstance(result, str)

from __future__ import annotations

from app.agents.react_graph import _parse_llm_json


def test_parse_llm_json_plain_object() -> None:
    raw = '{"thought":"plan","action":null,"final_answer":"Done."}'
    out = _parse_llm_json(raw)
    assert out is not None
    assert out["thought"] == "plan"
    assert out["final_answer"] == "Done."


def test_parse_llm_json_fenced() -> None:
    raw = '```json\n{"thought":"t","action":null,"final_answer":null}\n```'
    out = _parse_llm_json(raw)
    assert out is not None
    assert out["thought"] == "t"

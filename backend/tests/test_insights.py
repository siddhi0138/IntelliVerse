"""Tests the deterministic prompt-construction logic in insights.py —
what actually gets sent to the LLM — without calling FreeLLMAPI itself.
generate_simulation_explanation() end-to-end (which does hit the network) is
covered by manual curl verification during development, not here.
"""

import pytest

from insights import generate_simulation_explanation
from insights import InsightsUnavailable


@pytest.mark.asyncio
async def test_generate_simulation_explanation_raises_clearly_without_api_key(monkeypatch):
    monkeypatch.setattr("insights.LLM_API_KEY", "")
    simulation = {
        "driver_label": "Revenue",
        "driver_column": "Revenue",
        "pct_change": 20,
        "effects": [],
    }
    with pytest.raises(InsightsUnavailable):
        await generate_simulation_explanation("Retail", simulation)


# --- the LLM call: Groq model retirement and unexpected replies ------------------------

import json

import httpx

import insights


class _FakeClient:
    """Stands in for httpx.AsyncClient: plays back canned responses and records the requests."""

    def __init__(self, responses, sent):
        self._responses = responses
        self._sent = sent

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, headers=None, json=None):
        self._sent.append({"url": url, "payload": json})
        reply = self._responses.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def _response(status, body):
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    return httpx.Response(status, json=body, request=request)


def _ok(content):
    return _response(200, {"choices": [{"message": {"content": content}}]})


def _not_found():
    return _response(404, {"error": {"message": "The model `x` does not exist", "code": "model_not_found"}})


@pytest.fixture
def groq(monkeypatch):
    monkeypatch.setattr("insights.LLM_API_KEY", "test-key")
    monkeypatch.setattr("insights.LLM_BASE_URL", "https://api.groq.com/openai/v1")
    monkeypatch.setattr("insights.LLM_MODEL", "auto")
    monkeypatch.setattr("insights._working_model", None)
    sent = []

    def install(responses):
        monkeypatch.setattr("insights.httpx.AsyncClient", lambda **kw: _FakeClient(list(responses), sent))
        return sent

    return install


async def test_auto_on_groq_uses_a_current_model_and_low_reasoning(groq):
    sent = groq([_ok('{"summary": "fine"}')])
    assert await insights.call_llm_json("sys", "user") == {"summary": "fine"}
    payload = sent[0]["payload"]
    assert payload["model"] == "openai/gpt-oss-120b"
    assert payload["reasoning_effort"] == "low" and payload["include_reasoning"] is False


async def test_a_retired_model_falls_back_to_the_next_and_is_remembered(groq, monkeypatch):
    monkeypatch.setattr("insights.LLM_MODEL", "llama-3.3-70b-versatile")  # what the deployment may still have set
    sent = groq([_not_found(), _ok('{"a": 1}')])
    assert await insights.call_llm_json("sys", "user") == {"a": 1}
    assert [s["payload"]["model"] for s in sent] == ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]
    assert insights._working_model == "openai/gpt-oss-120b"


async def test_every_model_missing_is_a_clear_unavailable_error(groq):
    groq([_not_found(), _not_found(), _not_found()])
    with pytest.raises(InsightsUnavailable) as error:
        await insights.call_llm_json("sys", "user")
    assert "no available model" in str(error.value)


async def test_other_errors_show_the_providers_message_and_are_not_retried(groq):
    sent = groq([_response(401, {"error": {"message": "Invalid API Key"}})])
    with pytest.raises(InsightsUnavailable) as error:
        await insights.call_llm_json("sys", "user")
    assert "401" in str(error.value) and "Invalid API Key" in str(error.value)
    assert len(sent) == 1


@pytest.mark.parametrize("content", [None, "", "   ", "not json at all", "[1, 2]", "42"])
async def test_odd_replies_are_unavailable_not_a_crash(groq, content):
    groq([_ok(content)])
    with pytest.raises(InsightsUnavailable):
        await insights.call_llm_json("sys", "user")


async def test_a_markdown_fenced_json_reply_is_accepted(groq):
    groq([_ok('```json\n{"summary": "wrapped"}\n```')])
    assert await insights.call_llm_json("sys", "user") == {"summary": "wrapped"}


async def test_a_connection_failure_is_unavailable(groq):
    groq([httpx.ConnectError("refused")])
    with pytest.raises(InsightsUnavailable) as error:
        await insights.call_llm_json("sys", "user")
    assert "Could not reach LLM router" in str(error.value)


async def test_a_non_groq_router_keeps_using_the_configured_model_unchanged(monkeypatch):
    monkeypatch.setattr("insights.LLM_API_KEY", "test-key")
    monkeypatch.setattr("insights.LLM_BASE_URL", "http://localhost:3001/v1")
    monkeypatch.setattr("insights.LLM_MODEL", "auto")
    sent = []
    monkeypatch.setattr("insights.httpx.AsyncClient", lambda **kw: _FakeClient([_ok('{"ok": true}')], sent))
    await insights.call_llm_json("sys", "user")
    assert sent[0]["payload"]["model"] == "auto"
    assert "reasoning_effort" not in sent[0]["payload"]

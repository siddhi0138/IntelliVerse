"""Combines document retrieval (document_intelligence.search) with a
dataset's already-computed structured findings, when both are available,
into one grounded answer. Same compute-then-narrate rule as qa.py:
retrieval is the compute step; the LLM only narrates what was actually
retrieved, and is told to say so honestly if neither source answers the
question — no filling gaps with invented reasoning.
"""

from __future__ import annotations

import document_intelligence
from insights import call_llm_json

_SYSTEM_PROMPT = """You answer a user's question using ONLY the document excerpts and/or \
structured data findings provided below — never invent facts beyond what's given. When you use \
a document excerpt, cite it by filename. If neither source actually answers the question, say \
so honestly rather than guessing.

Respond with strict JSON only, no markdown fences:
{"answer": "2-5 sentence answer", "citations": ["filename.pdf", ...]}"""


async def answer_with_documents(
    username: str,
    question: str,
    structured_context: str | None = None,
) -> dict:
    chunks = document_intelligence.search(username, question, limit=5)

    if not chunks and not structured_context:
        return {
            "answer": "No documents have been uploaded yet, and no dataset was given for context — there's nothing to answer from.",
            "citations": [],
            "chunks_used": [],
        }

    parts = []
    if chunks:
        parts.append("Document excerpts:")
        for c in chunks:
            parts.append(f"[{c['filename']}] {c['text']}")
    if structured_context:
        parts.append("\nStructured data findings:")
        parts.append(structured_context)

    user_content = f"Question: {question}\n\n" + "\n".join(parts)
    result = await call_llm_json(_SYSTEM_PROMPT, user_content)

    return {
        "answer": result.get("answer", ""),
        "citations": result.get("citations", []),
        "chunks_used": chunks,
    }

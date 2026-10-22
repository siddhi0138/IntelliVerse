"""Document intelligence: the actual reason a vector index earns a place
in this stack. Every other "knowledge base" in this app is already
structured JSON (schema, stats, findings) — a vector database over that
would be adopting a technology nothing here needs. Unstructured documents
(PDFs, reports, SOPs, meeting notes) are different: there IS something to
retrieve, so retrieval-then-narrate is a genuine, not performative, use
of the pattern every other LLM call in this backend already follows.

Embeddings run locally via fastembed — no external API key, consistent
with the rest of this project's "self-hosted over SaaS" bias
(Prometheus/Grafana over Sentry/Langfuse). fastembed (not
sentence-transformers) specifically: it runs the same MiniLM-family model
through ONNX Runtime instead of PyTorch, which avoids the ~500MB+ of
resident memory PyTorch alone costs — on a memory-constrained deployment
(e.g. Render's free tier, ~512MB) that difference was the gap between this
feature working and it OOM-killing the entire backend process the first
time anyone uploaded a document, not just this feature returning an error.

Vectors themselves live in Postgres (pgvector), via catalog.py's
save_document_chunks/search_document_chunks/delete_document_chunks — the
same Neon instance already backing every other table in this app. This
used to be Qdrant (Cloud for production, on-disk for local dev); it moved
because Qdrant Cloud's free tier auto-suspends after a week of inactivity
and deletes after a month, which is a real, repeatedly-hit failure mode
for a side project that isn't used daily — pgvector on Postgres doesn't
have an equivalent expiry, and this app's realistic per-user document
count never needed a dedicated vector database's scale to begin with.

LlamaIndex wasn't adopted for the chunk/embed/retrieve pipeline itself:
its real value is multi-source query orchestration, which a single
document collection with one retrieval step doesn't need — direct
fastembed + a plain SQL query is simpler to read and debug for what's
actually being done here.
"""

from __future__ import annotations

import io
import re
from typing import TYPE_CHECKING

import docx
import pypdf
from pptx import Presentation

import catalog

if TYPE_CHECKING:
    # fastembed still isn't free (ONNX Runtime + the model weights), so it
    # stays deferred to _get_model() below — a process that never touches
    # document Q&A never pays for it.
    from fastembed import TextEmbedding

_EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_EMBEDDING_DIM = 384

_model: TextEmbedding | None = None


class UnsupportedDocumentError(Exception):
    pass


def _get_model() -> "TextEmbedding":
    global _model
    if _model is None:
        from fastembed import TextEmbedding

        _model = TextEmbedding(model_name=_EMBEDDING_MODEL_NAME)
    return _model


def extract_text(filename: str, content: bytes) -> str:
    lowered = filename.lower()
    if lowered.endswith(".pdf"):
        reader = pypdf.PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if lowered.endswith(".docx"):
        document = docx.Document(io.BytesIO(content))
        return "\n".join(p.text for p in document.paragraphs)
    if lowered.endswith(".pptx"):
        prs = Presentation(io.BytesIO(content))
        texts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if shape.has_text_frame:
                    texts.append(shape.text_frame.text)
        return "\n".join(texts)
    if lowered.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")
    raise UnsupportedDocumentError(f"Unsupported document type: {filename}. Use PDF, DOCX, PPTX, or TXT.")


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - overlap
    return chunks


def ingest_document(username: str, doc_id: str, filename: str, content: bytes) -> int:
    """Extracts, chunks, embeds, and stores a document. Returns the chunk count."""
    text = extract_text(filename, content)
    chunks = chunk_text(text)
    if not chunks:
        return 0

    model = _get_model()
    embeddings = [e.tolist() for e in model.embed(chunks)]
    catalog.save_document_chunks(username, doc_id, filename, chunks, embeddings)
    return len(chunks)


def search(username: str, query: str, limit: int = 5) -> list[dict]:
    model = _get_model()
    query_vector = next(model.embed([query])).tolist()
    results = catalog.search_document_chunks(username, query_vector, limit=limit)
    return [{**r, "score": round(r["score"], 4)} for r in results]


def delete_document(username: str, doc_id: str) -> None:
    catalog.delete_document_chunks(username, doc_id)

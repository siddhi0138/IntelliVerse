"""Metadata catalog: persists dataset metadata (not raw data) across
restarts, using SQLite — no extra dependency, no server process, matches
the "lean, local-first" pattern the rest of IntelliVerse follows. This is the
"internal memory for future versions" the roadmap describes.

Important scope note: this stores schema/quality/domain metadata, not the
uploaded file itself or its DataFrame. Re-opening an old catalog entry
lets you review and correct its semantic labels, but re-running charts/
simulation against it requires re-uploading the file — that in-memory
DataFrame cache is a separate, ephemeral thing (see main.py).
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from schema_inference import ColumnSchema

_DB_PATH = Path(__file__).parent / "data" / "nexus_catalog.db"


def _init_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS datasets (
            analysis_id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            row_count INTEGER NOT NULL,
            column_count INTEGER NOT NULL,
            domain TEXT NOT NULL,
            quality_score REAL NOT NULL,
            schema_json TEXT NOT NULL
        )
        """
    )
    conn.commit()


@contextmanager
def _connect():
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        _init_db(conn)
        yield conn
    finally:
        conn.close()


def save_dataset(
    analysis_id: str,
    filename: str,
    row_count: int,
    column_count: int,
    domain: str,
    quality_score: float,
    schema: list[ColumnSchema],
) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO datasets (analysis_id, filename, uploaded_at, row_count, column_count, domain, quality_score, schema_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(analysis_id) DO UPDATE SET schema_json = excluded.schema_json
            """,
            (
                analysis_id,
                filename,
                datetime.now(timezone.utc).isoformat(),
                row_count,
                column_count,
                domain,
                quality_score,
                json.dumps([asdict(c) for c in schema]),
            ),
        )
        conn.commit()


def list_datasets(limit: int = 50) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT analysis_id, filename, uploaded_at, row_count, column_count, domain, quality_score
            FROM datasets ORDER BY uploaded_at DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_dataset(analysis_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM datasets WHERE analysis_id = ?", (analysis_id,)).fetchone()
        if row is None:
            return None
        record = dict(row)
        record["schema"] = json.loads(record.pop("schema_json"))
        return record


def update_semantic_label(analysis_id: str, column_name: str, new_label: str) -> bool:
    with _connect() as conn:
        row = conn.execute("SELECT schema_json FROM datasets WHERE analysis_id = ?", (analysis_id,)).fetchone()
        if row is None:
            return False
        schema = json.loads(row["schema_json"])
        found = False
        for col in schema:
            if col["name"] == column_name:
                col["semantic_label"] = new_label
                col["confidence"] = 1.0  # user-confirmed
                found = True
                break
        if not found:
            return False
        conn.execute(
            "UPDATE datasets SET schema_json = ? WHERE analysis_id = ?",
            (json.dumps(schema), analysis_id),
        )
        conn.commit()
        return True

"""Metadata + workspace catalog: persists dataset metadata and full analysis
results per user across restarts, using SQLite — no extra dependency, no
server process, matches the "lean, local-first" pattern the rest of
IntelliVerse follows.

Scope note: the full `result_json` is the same dict /api/analyze returns,
so reopening a past dataset re-renders the whole dashboard with no
re-upload. What still requires re-upload is anything needing the live
pandas DataFrame — the SQL query panel, re-running simulations/forecasts
on demand, regenerating the action plan — since the raw uploaded file
itself is never persisted, only the computed result. Saved forecasts and
simulations are separate, explicitly-saved snapshots (a user clicks
"Save"), not automatic history.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from schema_inference import ColumnSchema

_DB_PATH = Path(__file__).parent / "data" / "nexus_catalog.db"


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


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
    # Added after auth: existing rows predate the concept of an owner and
    # are simply not visible to anyone under the new per-user filtering
    # (they're stale test data, not something to migrate/attribute).
    _add_column_if_missing(conn, "datasets", "username", "username TEXT")
    _add_column_if_missing(conn, "datasets", "result_json", "result_json TEXT")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_forecasts (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            username TEXT NOT NULL,
            label TEXT NOT NULL,
            saved_at TEXT NOT NULL,
            forecast_json TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_simulations (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            username TEXT NOT NULL,
            label TEXT NOT NULL,
            saved_at TEXT NOT NULL,
            simulation_json TEXT NOT NULL
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
    username: str,
    filename: str,
    row_count: int,
    column_count: int,
    domain: str,
    quality_score: float,
    schema: list[ColumnSchema],
    result: dict,
) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO datasets (analysis_id, username, filename, uploaded_at, row_count, column_count, domain, quality_score, schema_json, result_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(analysis_id) DO UPDATE SET schema_json = excluded.schema_json, result_json = excluded.result_json
            """,
            (
                analysis_id,
                username,
                filename,
                datetime.now(timezone.utc).isoformat(),
                row_count,
                column_count,
                domain,
                quality_score,
                json.dumps([asdict(c) for c in schema]),
                json.dumps(result),
            ),
        )
        conn.commit()


def list_datasets(username: str, limit: int = 50) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT analysis_id, filename, uploaded_at, row_count, column_count, domain, quality_score
            FROM datasets WHERE username = ? ORDER BY uploaded_at DESC LIMIT ?
            """,
            (username, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def get_dataset(analysis_id: str, username: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM datasets WHERE analysis_id = ? AND username = ?", (analysis_id, username)
        ).fetchone()
        if row is None:
            return None
        record = dict(row)
        record["schema"] = json.loads(record.pop("schema_json"))
        result_json = record.pop("result_json", None)
        record["result"] = json.loads(result_json) if result_json else None
        return record


def update_semantic_label(analysis_id: str, username: str, column_name: str, new_label: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT schema_json FROM datasets WHERE analysis_id = ? AND username = ?", (analysis_id, username)
        ).fetchone()
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
            "UPDATE datasets SET schema_json = ? WHERE analysis_id = ? AND username = ?",
            (json.dumps(schema), analysis_id, username),
        )
        conn.commit()
        return True


def save_forecast(analysis_id: str, username: str, label: str, forecast: dict) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO saved_forecasts (id, analysis_id, username, label, saved_at, forecast_json) VALUES (?, ?, ?, ?, ?, ?)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(forecast)),
        )
        conn.commit()
    return saved_id


def list_saved_forecasts(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, label, saved_at, forecast_json FROM saved_forecasts WHERE analysis_id = ? AND username = ? ORDER BY saved_at DESC",
            (analysis_id, username),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["forecast"] = json.loads(d.pop("forecast_json"))
            out.append(d)
        return out


def save_simulation(analysis_id: str, username: str, label: str, simulation: dict) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO saved_simulations (id, analysis_id, username, label, saved_at, simulation_json) VALUES (?, ?, ?, ?, ?, ?)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(simulation)),
        )
        conn.commit()
    return saved_id


def list_saved_simulations(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, label, saved_at, simulation_json FROM saved_simulations WHERE analysis_id = ? AND username = ? ORDER BY saved_at DESC",
            (analysis_id, username),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["simulation"] = json.loads(d.pop("simulation_json"))
            out.append(d)
        return out

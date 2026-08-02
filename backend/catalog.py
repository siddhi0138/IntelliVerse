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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_action_plans (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            username TEXT NOT NULL,
            label TEXT NOT NULL,
            saved_at TEXT NOT NULL,
            plan_json TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_optimizations (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            username TEXT NOT NULL,
            label TEXT NOT NULL,
            saved_at TEXT NOT NULL,
            result_json TEXT NOT NULL
        )
        """
    )
    # Only the query text is kept, not its result set — SQL results can run
    # to hundreds of rows and are cheap to recompute by re-running the saved
    # query, unlike a forecast/simulation/optimization run.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS saved_queries (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            username TEXT NOT NULL,
            label TEXT NOT NULL,
            saved_at TEXT NOT NULL,
            sql_text TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            doc_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            filename TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            chunk_count INTEGER NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS workspaces (
            workspace_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            created_at TEXT NOT NULL,
            tables_json TEXT NOT NULL,
            node_count INTEGER NOT NULL DEFAULT 0,
            edge_count INTEGER NOT NULL DEFAULT 0,
            analytics_json TEXT
        )
        """
    )
    # Added after the initial auto-persist-on-build design: a distinct,
    # user-triggered "Save" click updates this timestamp, separately from
    # the automatic persistence that already happens when the graph is
    # built (that one is a safety net; this one is an explicit confirmation
    # the user can see and re-trigger).
    _add_column_if_missing(conn, "workspaces", "saved_at", "saved_at TEXT")

    # Added after discovering saved forecasts/simulations/action plans were
    # indistinguishable once the persona that produced their AI narration
    # was gone from the navbar — two saves under different personas looked
    # identical in the saved list. NULL for rows saved before this column
    # existed (no persona was recorded then, not that none was used).
    _add_column_if_missing(conn, "saved_forecasts", "persona", "persona TEXT")
    _add_column_if_missing(conn, "saved_simulations", "persona", "persona TEXT")
    _add_column_if_missing(conn, "saved_action_plans", "persona", "persona TEXT")
    _add_column_if_missing(conn, "saved_optimizations", "persona", "persona TEXT")

    # Generic cache for AI-narrated text (dataset summary, forecast
    # explanation, action plan) keyed by analysis_id + a caller-chosen
    # cache_key — added because that narration was being re-generated (and
    # visibly flashing "isn't available"/re-thinking) on every refresh or
    # tab switch instead of surviving like the rest of the analysis result.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_cache (
            analysis_id TEXT NOT NULL,
            username TEXT NOT NULL,
            cache_key TEXT NOT NULL,
            content_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (analysis_id, username, cache_key)
        )
        """
    )

    # V9: one row per incremental-model update (see incremental_model.py) —
    # this is what lets the UI chart "accuracy improves as more data streams
    # in" instead of just asserting it.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS model_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id TEXT NOT NULL,
            username TEXT NOT NULL,
            target_column TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            prediction REAL,
            actual REAL NOT NULL,
            abs_pct_error REAL,
            n_updates INTEGER NOT NULL
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
            ON CONFLICT(analysis_id) DO UPDATE SET
                row_count = excluded.row_count,
                column_count = excluded.column_count,
                domain = excluded.domain,
                quality_score = excluded.quality_score,
                schema_json = excluded.schema_json,
                result_json = excluded.result_json
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


def delete_dataset(analysis_id: str, username: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM datasets WHERE analysis_id = ? AND username = ?", (analysis_id, username))
        # Saved forecasts/simulations are meaningless without their parent
        # dataset — clean them up together rather than leaving orphans.
        conn.execute(
            "DELETE FROM saved_forecasts WHERE analysis_id = ? AND username = ?", (analysis_id, username)
        )
        conn.execute(
            "DELETE FROM saved_simulations WHERE analysis_id = ? AND username = ?", (analysis_id, username)
        )
        conn.execute(
            "DELETE FROM saved_action_plans WHERE analysis_id = ? AND username = ?", (analysis_id, username)
        )
        conn.execute(
            "DELETE FROM saved_optimizations WHERE analysis_id = ? AND username = ?", (analysis_id, username)
        )
        conn.execute(
            "DELETE FROM saved_queries WHERE analysis_id = ? AND username = ?", (analysis_id, username)
        )
        conn.execute(
            "DELETE FROM ai_cache WHERE analysis_id = ? AND username = ?", (analysis_id, username)
        )
        conn.execute(
            "DELETE FROM model_history WHERE analysis_id = ? AND username = ?", (analysis_id, username)
        )
        conn.commit()
        return cur.rowcount > 0


def delete_all_datasets(username: str) -> list[str]:
    """Empties the catalog for one user. Returns the analysis_ids removed,
    so callers can also evict exactly those (and no one else's) entries
    from any in-memory, non-user-scoped caches keyed by analysis_id."""
    with _connect() as conn:
        rows = conn.execute("SELECT analysis_id FROM datasets WHERE username = ?", (username,)).fetchall()
        analysis_ids = [r["analysis_id"] for r in rows]
        conn.execute("DELETE FROM datasets WHERE username = ?", (username,))
        conn.execute("DELETE FROM saved_forecasts WHERE username = ?", (username,))
        conn.execute("DELETE FROM saved_simulations WHERE username = ?", (username,))
        conn.execute("DELETE FROM saved_action_plans WHERE username = ?", (username,))
        conn.execute("DELETE FROM saved_optimizations WHERE username = ?", (username,))
        conn.execute("DELETE FROM saved_queries WHERE username = ?", (username,))
        conn.execute("DELETE FROM ai_cache WHERE username = ?", (username,))
        conn.execute("DELETE FROM model_history WHERE username = ?", (username,))
        conn.commit()
        return analysis_ids


def get_ai_cache(analysis_id: str, username: str, cache_key: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT content_json FROM ai_cache WHERE analysis_id = ? AND username = ? AND cache_key = ?",
            (analysis_id, username, cache_key),
        ).fetchone()
        return json.loads(row["content_json"]) if row else None


def save_ai_cache(analysis_id: str, username: str, cache_key: str, content: dict) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO ai_cache (analysis_id, username, cache_key, content_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(analysis_id, username, cache_key) DO UPDATE SET content_json = excluded.content_json, created_at = excluded.created_at
            """,
            (analysis_id, username, cache_key, json.dumps(content), datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()


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


def save_forecast(analysis_id: str, username: str, label: str, forecast: dict, persona: str | None = None) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO saved_forecasts (id, analysis_id, username, label, saved_at, forecast_json, persona) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(forecast), persona),
        )
        conn.commit()
    return saved_id


def list_saved_forecasts(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, label, saved_at, forecast_json, persona FROM saved_forecasts WHERE analysis_id = ? AND username = ? ORDER BY saved_at DESC",
            (analysis_id, username),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["forecast"] = json.loads(d.pop("forecast_json"))
            out.append(d)
        return out


def delete_forecast(saved_id: str, username: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM saved_forecasts WHERE id = ? AND username = ?", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_simulation(analysis_id: str, username: str, label: str, simulation: dict, persona: str | None = None) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO saved_simulations (id, analysis_id, username, label, saved_at, simulation_json, persona) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(simulation), persona),
        )
        conn.commit()
    return saved_id


def list_saved_simulations(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, label, saved_at, simulation_json, persona FROM saved_simulations WHERE analysis_id = ? AND username = ? ORDER BY saved_at DESC",
            (analysis_id, username),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["simulation"] = json.loads(d.pop("simulation_json"))
            out.append(d)
        return out


def delete_simulation(saved_id: str, username: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM saved_simulations WHERE id = ? AND username = ?", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_action_plan(analysis_id: str, username: str, label: str, plan: dict, persona: str | None = None) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO saved_action_plans (id, analysis_id, username, label, saved_at, plan_json, persona) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(plan), persona),
        )
        conn.commit()
    return saved_id


def list_saved_action_plans(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, label, saved_at, plan_json, persona FROM saved_action_plans WHERE analysis_id = ? AND username = ? ORDER BY saved_at DESC",
            (analysis_id, username),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["plan"] = json.loads(d.pop("plan_json"))
            out.append(d)
        return out


def delete_action_plan(saved_id: str, username: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM saved_action_plans WHERE id = ? AND username = ?", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_optimization(analysis_id: str, username: str, label: str, result: dict, persona: str | None = None) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO saved_optimizations (id, analysis_id, username, label, saved_at, result_json, persona) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(result), persona),
        )
        conn.commit()
    return saved_id


def list_saved_optimizations(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, label, saved_at, result_json, persona FROM saved_optimizations WHERE analysis_id = ? AND username = ? ORDER BY saved_at DESC",
            (analysis_id, username),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["result"] = json.loads(d.pop("result_json"))
            out.append(d)
        return out


def delete_optimization(saved_id: str, username: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM saved_optimizations WHERE id = ? AND username = ?", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_query(analysis_id: str, username: str, label: str, sql_text: str) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO saved_queries (id, analysis_id, username, label, saved_at, sql_text) VALUES (?, ?, ?, ?, ?, ?)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), sql_text),
        )
        conn.commit()
    return saved_id


def list_saved_queries(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, label, saved_at, sql_text FROM saved_queries WHERE analysis_id = ? AND username = ? ORDER BY saved_at DESC",
            (analysis_id, username),
        ).fetchall()
        return [dict(r) for r in rows]


def delete_query(saved_id: str, username: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM saved_queries WHERE id = ? AND username = ?", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_document(doc_id: str, username: str, filename: str, chunk_count: int) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO documents (doc_id, username, filename, uploaded_at, chunk_count) VALUES (?, ?, ?, ?, ?)",
            (doc_id, username, filename, datetime.now(timezone.utc).isoformat(), chunk_count),
        )
        conn.commit()


def list_documents(username: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT doc_id, filename, uploaded_at, chunk_count FROM documents WHERE username = ? ORDER BY uploaded_at DESC",
            (username,),
        ).fetchall()
        return [dict(r) for r in rows]


def delete_document_record(doc_id: str, username: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM documents WHERE doc_id = ? AND username = ?", (doc_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_workspace(workspace_id: str, username: str, tables: list[dict]) -> None:
    """Called right after upload — persists the table summary so the
    workspace survives a refresh even before a graph has been confirmed."""
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO workspaces (workspace_id, username, created_at, tables_json)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(workspace_id) DO UPDATE SET tables_json = excluded.tables_json
            """,
            (workspace_id, username, datetime.now(timezone.utc).isoformat(), json.dumps(tables)),
        )
        conn.commit()


def update_workspace_graph(workspace_id: str, username: str, node_count: int, edge_count: int, analytics: dict) -> bool:
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE workspaces SET node_count = ?, edge_count = ?, analytics_json = ? WHERE workspace_id = ? AND username = ?",
            (node_count, edge_count, json.dumps(analytics), workspace_id, username),
        )
        conn.commit()
        return cur.rowcount > 0


def mark_workspace_saved(workspace_id: str, username: str) -> str | None:
    """Explicit, user-triggered save — returns the new saved_at timestamp,
    or None if the workspace (or its confirmed graph) doesn't exist."""
    saved_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE workspaces SET saved_at = ? WHERE workspace_id = ? AND username = ? AND analytics_json IS NOT NULL",
            (saved_at, workspace_id, username),
        )
        conn.commit()
        return saved_at if cur.rowcount > 0 else None


def get_workspace(workspace_id: str, username: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM workspaces WHERE workspace_id = ? AND username = ?", (workspace_id, username)
        ).fetchone()
        if row is None:
            return None
        record = dict(row)
        record["tables"] = json.loads(record.pop("tables_json"))
        analytics_json = record.pop("analytics_json", None)
        record["analytics"] = json.loads(analytics_json) if analytics_json else None
        return record


def delete_workspace(workspace_id: str, username: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM workspaces WHERE workspace_id = ? AND username = ?", (workspace_id, username))
        conn.commit()
        return cur.rowcount > 0


def log_model_update(analysis_id: str, username: str, target_column: str, update: dict) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO model_history (analysis_id, username, target_column, updated_at, prediction, actual, abs_pct_error, n_updates)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                analysis_id,
                username,
                target_column,
                datetime.now(timezone.utc).isoformat(),
                update.get("prediction_before_update"),
                update["actual"],
                update.get("abs_pct_error"),
                update["n_updates"],
            ),
        )
        conn.commit()


def get_model_history(analysis_id: str, username: str, target_column: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT updated_at, prediction, actual, abs_pct_error, n_updates FROM model_history
            WHERE analysis_id = ? AND username = ? AND target_column = ? ORDER BY id ASC
            """,
            (analysis_id, username, target_column),
        ).fetchall()
        return [dict(r) for r in rows]

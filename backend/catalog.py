"""Metadata + workspace catalog: persists dataset metadata and full analysis
results per user across restarts, using the same Postgres instance auth.py
already connects to.

This used to be SQLite, sitting on a local file at backend/data/ — that
works great when something (a docker-compose volume, your own hard drive)
actually persists that directory, but a plain Render web service's disk is
ephemeral: every redeploy silently wiped every dataset, saved forecast/
simulation/optimization/query, ask history, and the incremental-learning
model's progress. Postgres was already deployed and paid for (auth needs
it), so moving the catalog onto it is a real persistence fix that costs
nothing extra, instead of requiring a paid Render disk add-on.

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
import os
import uuid
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

from schema_inference import ColumnSchema

POSTGRES_DSN = os.environ["POSTGRES_DSN"]

# _init_db runs ~18 schema-check round trips (CREATE TABLE IF NOT EXISTS +
# ALTER TABLE checks). Against Render's own low-latency Postgres that was
# free; against a serverless provider like Neon (each round trip pays real
# network latency, not just local-socket time) it added 9-11+ seconds to
# *every single* catalog call. The schema doesn't change between calls, so
# checking it once per process instead of once per connection removes that
# tax without changing behavior — a fresh connection still initializes the
# schema on the first catalog call after a cold start/redeploy.
_schema_ready = False


def _add_column_if_missing(conn, table: str, column: str, ddl: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.columns WHERE table_name = %s AND column_name = %s",
            (table, column),
        )
        if cur.fetchone() is None:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def _init_db(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
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

        cur.execute(
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
        cur.execute(
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
        cur.execute(
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
        cur.execute(
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
        cur.execute(
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
        cur.execute(
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
        cur.execute(
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
        cur.execute(
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
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS model_history (
                id SERIAL PRIMARY KEY,
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
    global _schema_ready
    conn = psycopg2.connect(POSTGRES_DSN, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        if not _schema_ready:
            _init_db(conn)
            _schema_ready = True
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
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO datasets (analysis_id, username, filename, uploaded_at, row_count, column_count, domain, quality_score, schema_json, result_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (analysis_id) DO UPDATE SET
                row_count = EXCLUDED.row_count,
                column_count = EXCLUDED.column_count,
                domain = EXCLUDED.domain,
                quality_score = EXCLUDED.quality_score,
                schema_json = EXCLUDED.schema_json,
                result_json = EXCLUDED.result_json
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
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT analysis_id, filename, uploaded_at, row_count, column_count, domain, quality_score
            FROM datasets WHERE username = %s ORDER BY uploaded_at DESC LIMIT %s
            """,
            (username, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def get_dataset(analysis_id: str, username: str) -> dict | None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM datasets WHERE analysis_id = %s AND username = %s", (analysis_id, username))
        row = cur.fetchone()
        if row is None:
            return None
        record = dict(row)
        record["schema"] = json.loads(record.pop("schema_json"))
        result_json = record.pop("result_json", None)
        record["result"] = json.loads(result_json) if result_json else None
        return record


def delete_dataset(analysis_id: str, username: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM datasets WHERE analysis_id = %s AND username = %s", (analysis_id, username))
        deleted = cur.rowcount > 0
        # Saved forecasts/simulations are meaningless without their parent
        # dataset — clean them up together rather than leaving orphans.
        cur.execute("DELETE FROM saved_forecasts WHERE analysis_id = %s AND username = %s", (analysis_id, username))
        cur.execute("DELETE FROM saved_simulations WHERE analysis_id = %s AND username = %s", (analysis_id, username))
        cur.execute("DELETE FROM saved_action_plans WHERE analysis_id = %s AND username = %s", (analysis_id, username))
        cur.execute("DELETE FROM saved_optimizations WHERE analysis_id = %s AND username = %s", (analysis_id, username))
        cur.execute("DELETE FROM saved_queries WHERE analysis_id = %s AND username = %s", (analysis_id, username))
        cur.execute("DELETE FROM ai_cache WHERE analysis_id = %s AND username = %s", (analysis_id, username))
        cur.execute("DELETE FROM model_history WHERE analysis_id = %s AND username = %s", (analysis_id, username))
        conn.commit()
        return deleted


def delete_all_datasets(username: str) -> list[str]:
    """Empties the catalog for one user. Returns the analysis_ids removed,
    so callers can also evict exactly those (and no one else's) entries
    from any in-memory, non-user-scoped caches keyed by analysis_id."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT analysis_id FROM datasets WHERE username = %s", (username,))
        analysis_ids = [r["analysis_id"] for r in cur.fetchall()]
        cur.execute("DELETE FROM datasets WHERE username = %s", (username,))
        cur.execute("DELETE FROM saved_forecasts WHERE username = %s", (username,))
        cur.execute("DELETE FROM saved_simulations WHERE username = %s", (username,))
        cur.execute("DELETE FROM saved_action_plans WHERE username = %s", (username,))
        cur.execute("DELETE FROM saved_optimizations WHERE username = %s", (username,))
        cur.execute("DELETE FROM saved_queries WHERE username = %s", (username,))
        cur.execute("DELETE FROM ai_cache WHERE username = %s", (username,))
        cur.execute("DELETE FROM model_history WHERE username = %s", (username,))
        conn.commit()
        return analysis_ids


def get_ai_cache(analysis_id: str, username: str, cache_key: str) -> dict | None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT content_json FROM ai_cache WHERE analysis_id = %s AND username = %s AND cache_key = %s",
            (analysis_id, username, cache_key),
        )
        row = cur.fetchone()
        return json.loads(row["content_json"]) if row else None


def save_ai_cache(analysis_id: str, username: str, cache_key: str, content: dict) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ai_cache (analysis_id, username, cache_key, content_json, created_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (analysis_id, username, cache_key) DO UPDATE SET
                content_json = EXCLUDED.content_json, created_at = EXCLUDED.created_at
            """,
            (analysis_id, username, cache_key, json.dumps(content), datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()


def update_semantic_label(analysis_id: str, username: str, column_name: str, new_label: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT schema_json FROM datasets WHERE analysis_id = %s AND username = %s", (analysis_id, username)
        )
        row = cur.fetchone()
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
        cur.execute(
            "UPDATE datasets SET schema_json = %s WHERE analysis_id = %s AND username = %s",
            (json.dumps(schema), analysis_id, username),
        )
        conn.commit()
        return True


def save_forecast(analysis_id: str, username: str, label: str, forecast: dict, persona: str | None = None) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO saved_forecasts (id, analysis_id, username, label, saved_at, forecast_json, persona) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(forecast), persona),
        )
        conn.commit()
    return saved_id


def list_saved_forecasts(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, label, saved_at, forecast_json, persona FROM saved_forecasts WHERE analysis_id = %s AND username = %s ORDER BY saved_at DESC",
            (analysis_id, username),
        )
        out = []
        for r in cur.fetchall():
            d = dict(r)
            d["forecast"] = json.loads(d.pop("forecast_json"))
            out.append(d)
        return out


def delete_forecast(saved_id: str, username: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM saved_forecasts WHERE id = %s AND username = %s", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_simulation(analysis_id: str, username: str, label: str, simulation: dict, persona: str | None = None) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO saved_simulations (id, analysis_id, username, label, saved_at, simulation_json, persona) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(simulation), persona),
        )
        conn.commit()
    return saved_id


def list_saved_simulations(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, label, saved_at, simulation_json, persona FROM saved_simulations WHERE analysis_id = %s AND username = %s ORDER BY saved_at DESC",
            (analysis_id, username),
        )
        out = []
        for r in cur.fetchall():
            d = dict(r)
            d["simulation"] = json.loads(d.pop("simulation_json"))
            out.append(d)
        return out


def delete_simulation(saved_id: str, username: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM saved_simulations WHERE id = %s AND username = %s", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_action_plan(analysis_id: str, username: str, label: str, plan: dict, persona: str | None = None) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO saved_action_plans (id, analysis_id, username, label, saved_at, plan_json, persona) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(plan), persona),
        )
        conn.commit()
    return saved_id


def list_saved_action_plans(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, label, saved_at, plan_json, persona FROM saved_action_plans WHERE analysis_id = %s AND username = %s ORDER BY saved_at DESC",
            (analysis_id, username),
        )
        out = []
        for r in cur.fetchall():
            d = dict(r)
            d["plan"] = json.loads(d.pop("plan_json"))
            out.append(d)
        return out


def delete_action_plan(saved_id: str, username: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM saved_action_plans WHERE id = %s AND username = %s", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_optimization(analysis_id: str, username: str, label: str, result: dict, persona: str | None = None) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO saved_optimizations (id, analysis_id, username, label, saved_at, result_json, persona) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), json.dumps(result), persona),
        )
        conn.commit()
    return saved_id


def list_saved_optimizations(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, label, saved_at, result_json, persona FROM saved_optimizations WHERE analysis_id = %s AND username = %s ORDER BY saved_at DESC",
            (analysis_id, username),
        )
        out = []
        for r in cur.fetchall():
            d = dict(r)
            d["result"] = json.loads(d.pop("result_json"))
            out.append(d)
        return out


def delete_optimization(saved_id: str, username: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM saved_optimizations WHERE id = %s AND username = %s", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_query(analysis_id: str, username: str, label: str, sql_text: str) -> str:
    saved_id = str(uuid.uuid4())
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO saved_queries (id, analysis_id, username, label, saved_at, sql_text) VALUES (%s, %s, %s, %s, %s, %s)",
            (saved_id, analysis_id, username, label, datetime.now(timezone.utc).isoformat(), sql_text),
        )
        conn.commit()
    return saved_id


def list_saved_queries(analysis_id: str, username: str) -> list[dict]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, label, saved_at, sql_text FROM saved_queries WHERE analysis_id = %s AND username = %s ORDER BY saved_at DESC",
            (analysis_id, username),
        )
        return [dict(r) for r in cur.fetchall()]


def delete_query(saved_id: str, username: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM saved_queries WHERE id = %s AND username = %s", (saved_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_document(doc_id: str, username: str, filename: str, chunk_count: int) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (doc_id, username, filename, uploaded_at, chunk_count) VALUES (%s, %s, %s, %s, %s)",
            (doc_id, username, filename, datetime.now(timezone.utc).isoformat(), chunk_count),
        )
        conn.commit()


def list_documents(username: str) -> list[dict]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT doc_id, filename, uploaded_at, chunk_count FROM documents WHERE username = %s ORDER BY uploaded_at DESC",
            (username,),
        )
        return [dict(r) for r in cur.fetchall()]


def delete_document_record(doc_id: str, username: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM documents WHERE doc_id = %s AND username = %s", (doc_id, username))
        conn.commit()
        return cur.rowcount > 0


def save_workspace(workspace_id: str, username: str, tables: list[dict]) -> None:
    """Called right after upload — persists the table summary so the
    workspace survives a refresh even before a graph has been confirmed."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO workspaces (workspace_id, username, created_at, tables_json)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (workspace_id) DO UPDATE SET tables_json = EXCLUDED.tables_json
            """,
            (workspace_id, username, datetime.now(timezone.utc).isoformat(), json.dumps(tables)),
        )
        conn.commit()


def update_workspace_graph(workspace_id: str, username: str, node_count: int, edge_count: int, analytics: dict) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE workspaces SET node_count = %s, edge_count = %s, analytics_json = %s WHERE workspace_id = %s AND username = %s",
            (node_count, edge_count, json.dumps(analytics), workspace_id, username),
        )
        conn.commit()
        return cur.rowcount > 0


def mark_workspace_saved(workspace_id: str, username: str) -> str | None:
    """Explicit, user-triggered save — returns the new saved_at timestamp,
    or None if the workspace (or its confirmed graph) doesn't exist."""
    saved_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE workspaces SET saved_at = %s WHERE workspace_id = %s AND username = %s AND analytics_json IS NOT NULL",
            (saved_at, workspace_id, username),
        )
        conn.commit()
        return saved_at if cur.rowcount > 0 else None


def get_workspace(workspace_id: str, username: str) -> dict | None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM workspaces WHERE workspace_id = %s AND username = %s", (workspace_id, username))
        row = cur.fetchone()
        if row is None:
            return None
        record = dict(row)
        record["tables"] = json.loads(record.pop("tables_json"))
        analytics_json = record.pop("analytics_json", None)
        record["analytics"] = json.loads(analytics_json) if analytics_json else None
        return record


def delete_workspace(workspace_id: str, username: str) -> bool:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM workspaces WHERE workspace_id = %s AND username = %s", (workspace_id, username))
        conn.commit()
        return cur.rowcount > 0


def log_model_update(analysis_id: str, username: str, target_column: str, update: dict) -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO model_history (analysis_id, username, target_column, updated_at, prediction, actual, abs_pct_error, n_updates)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
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
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT updated_at, prediction, actual, abs_pct_error, n_updates FROM model_history
            WHERE analysis_id = %s AND username = %s AND target_column = %s ORDER BY id ASC
            """,
            (analysis_id, username, target_column),
        )
        return [dict(r) for r in cur.fetchall()]

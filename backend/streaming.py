"""V9: real-time streaming ingestion via Kafka.

There's no live external feed for an uploaded CSV, so a synthetic producer
simulates one — resampling realistic new rows from the dataset's own
historical distribution (bootstrap sampling + small jitter on numeric
columns) at a fixed interval, exactly the "new order every few seconds"
scenario this was modeled on. What's real is everything downstream of
that: the row is published to an actual Kafka topic, consumed by a real
`aiokafka` consumer (genuinely decoupled from the producer through the
broker, not a direct function call), appended to the live analysis, run
through the incremental model, and pushed to any connected browser over a
WebSocket — the same "background task + wake a waiting websocket" pattern
`progress_jobs.py` already uses for analysis progress.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import ssl
from dataclasses import dataclass, field

import pandas as pd
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from loguru import logger

import catalog
from incremental_model import IncrementalMetricModel
from schema_inference import ColumnSchema

KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
# Local/docker-compose Kafka is unauthenticated PLAINTEXT (the default,
# unchanged). A hosted broker — Aiven for Apache Kafka (verified working),
# Redpanda Cloud, Confluent Cloud, etc. — needs SASL_SSL plus real
# credentials instead, e.g. KAFKA_SECURITY_PROTOCOL=SASL_SSL,
# KAFKA_SASL_MECHANISM=SCRAM-SHA-256, KAFKA_SASL_USERNAME/KAFKA_SASL_PASSWORD
# from that provider (plus KAFKA_SSL_CA_CERT below if it signs its own
# certificate) — configured generically via env vars rather than hardcoding
# one provider's shape.
KAFKA_SECURITY_PROTOCOL = os.environ.get("KAFKA_SECURITY_PROTOCOL", "PLAINTEXT")
KAFKA_SASL_MECHANISM = os.environ.get("KAFKA_SASL_MECHANISM", "PLAIN")
KAFKA_SASL_USERNAME = os.environ.get("KAFKA_SASL_USERNAME")
KAFKA_SASL_PASSWORD = os.environ.get("KAFKA_SASL_PASSWORD")
# Some hosted brokers (Aiven, etc.) sign their server certificate with their
# own private CA rather than a publicly-trusted one — the system's default
# trust store rejects it (CERTIFICATE_VERIFY_FAILED) unless that CA is
# explicitly trusted too. Holds the CA cert's PEM content directly (not a
# file path), since that's what a platform's env var UI can actually hold.
# Some UIs only accept single-line values, so a literal "\n" is unescaped
# back into a real newline before use.
KAFKA_SSL_CA_CERT = os.environ.get("KAFKA_SSL_CA_CERT")
TOPIC = "intelliverse.live-rows"
PRODUCE_INTERVAL_SECONDS = 4.0


def _kafka_auth_kwargs() -> dict:
    kwargs: dict = {"security_protocol": KAFKA_SECURITY_PROTOCOL}
    if "SSL" in KAFKA_SECURITY_PROTOCOL:
        cadata = KAFKA_SSL_CA_CERT.replace("\\n", "\n") if KAFKA_SSL_CA_CERT else None
        kwargs["ssl_context"] = ssl.create_default_context(cadata=cadata)
    if "SASL" in KAFKA_SECURITY_PROTOCOL:
        kwargs["sasl_mechanism"] = KAFKA_SASL_MECHANISM
        kwargs["sasl_plain_username"] = KAFKA_SASL_USERNAME
        kwargs["sasl_plain_password"] = KAFKA_SASL_PASSWORD
    return kwargs


@dataclass
class LiveStream:
    analysis_id: str
    loop: asyncio.AbstractEventLoop
    log: list[dict] = field(default_factory=list)
    running: bool = True
    row_count: int = 0
    _event: asyncio.Event = field(default_factory=asyncio.Event)

    def push(self, message: dict) -> None:
        self.log.append(message)
        # Keep only recent history in memory — a WebSocket client that's
        # been connected a while doesn't need to replay hundreds of events.
        if len(self.log) > 200:
            self.log = self.log[-200:]
        self.loop.call_soon_threadsafe(self._event.set)

    async def wait_for_update(self) -> None:
        await self._event.wait()
        self._event.clear()


_STREAMS: dict[str, LiveStream] = {}
_PRODUCER_TASKS: dict[str, asyncio.Task] = {}
_PRODUCER: AIOKafkaProducer | None = None
_CONSUMER_TASK: asyncio.Task | None = None


def _sample_synthetic_row(df: pd.DataFrame, schema: list[ColumnSchema]) -> dict:
    row: dict = {}
    for col in schema:
        series = df[col.name].dropna()
        if series.empty:
            row[col.name] = None
            continue
        if col.type == "numeric":
            base = float(series.sample(1).iloc[0])
            jitter = random.uniform(-0.15, 0.2)
            row[col.name] = round(base * (1 + jitter), 2)
        elif col.type == "date":
            row[col.name] = pd.Timestamp.utcnow().strftime("%Y-%m-%d")
        else:
            row[col.name] = series.sample(1).iloc[0]
    return row


async def _get_producer() -> AIOKafkaProducer:
    global _PRODUCER
    if _PRODUCER is None:
        _PRODUCER = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            **_kafka_auth_kwargs(),
        )
        await _PRODUCER.start()
    return _PRODUCER


async def _produce_loop(analysis_id: str, username: str, df_cache: dict[str, pd.DataFrame], schema: list[ColumnSchema]) -> None:
    producer = await _get_producer()
    stream = _STREAMS[analysis_id]
    try:
        while stream.running:
            await asyncio.sleep(PRODUCE_INTERVAL_SECONDS)
            df = df_cache.get(analysis_id)
            if df is None:
                break
            row = _sample_synthetic_row(df, schema)
            await producer.send_and_wait(TOPIC, {"analysis_id": analysis_id, "username": username, "row": row})
    except asyncio.CancelledError:
        pass
    except Exception as exc:  # pragma: no cover - defensive, streaming is best-effort
        logger.warning(f"Live producer for {analysis_id} stopped: {exc}")


def start_stream(
    analysis_id: str, username: str, df_cache: dict[str, pd.DataFrame], schema: list[ColumnSchema]
) -> LiveStream:
    existing = _STREAMS.get(analysis_id)
    if existing and existing.running:
        return existing
    stream = LiveStream(analysis_id=analysis_id, loop=asyncio.get_running_loop())
    _STREAMS[analysis_id] = stream
    _PRODUCER_TASKS[analysis_id] = asyncio.create_task(_produce_loop(analysis_id, username, df_cache, schema))
    return stream


def stop_stream(analysis_id: str) -> bool:
    stream = _STREAMS.get(analysis_id)
    if not stream:
        return False
    stream.running = False
    task = _PRODUCER_TASKS.pop(analysis_id, None)
    if task:
        task.cancel()
    return True


def get_stream(analysis_id: str) -> LiveStream | None:
    return _STREAMS.get(analysis_id)


async def run_consumer(df_cache: dict[str, pd.DataFrame], primary_metric_getter) -> None:
    """One global consumer for the whole process — routes each message to
    the right dataset's live state by analysis_id. Started once at app
    startup; keeps retrying if Kafka isn't reachable yet (it's a sibling
    container that may still be booting).

    Some deployments (e.g. a single Render web service, with no Kafka
    container alongside it) never have a broker to reach at all — the
    real-time streaming feature simply isn't available there, same as any
    other optional dependency. Retrying forever at a fixed 5s interval would
    spam the logs indefinitely in that case, so the backoff grows (capped at
    2 minutes) instead, and the "still waiting" log line only repeats every
    10th attempt once it's clearly not a brief startup race anymore."""
    backoff = 5.0
    attempt = 0
    while True:
        try:
            consumer = AIOKafkaConsumer(
                TOPIC,
                bootstrap_servers=KAFKA_BOOTSTRAP,
                value_deserializer=lambda v: json.loads(v.decode("utf-8")),
                auto_offset_reset="latest",
                group_id="intelliverse-backend",
                **_kafka_auth_kwargs(),
            )
            await consumer.start()
        except Exception as exc:
            attempt += 1
            if attempt == 1:
                # Full traceback + chained cause on the very first failure
                # only — "Connection ... closed" alone doesn't say whether
                # this failed during the TLS handshake, SASL login, or
                # something else entirely, and that's the one thing needed
                # to actually diagnose a hosted-broker misconfiguration.
                logger.opt(exception=True).error(f"Kafka consumer failed to start (attempt 1): {exc!r}")
            if attempt <= 3 or attempt % 10 == 0:
                logger.warning(
                    f"Kafka consumer could not start yet ({exc}); retrying in {backoff:.0f}s "
                    f"(attempt {attempt} — if this keeps failing, this deployment likely has no "
                    f"Kafka broker configured, and real-time streaming just isn't available here)."
                )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 120.0)
            continue

        backoff = 5.0
        attempt = 0
        try:
            async for msg in consumer:
                try:
                    _handle_message(msg.value, df_cache, primary_metric_getter)
                except Exception as exc:  # pragma: no cover - one bad message shouldn't kill the consumer
                    logger.warning(f"Failed to process live row: {exc}")
        finally:
            await consumer.stop()


def _handle_message(payload: dict, df_cache: dict[str, pd.DataFrame], primary_metric_getter) -> None:
    analysis_id = payload["analysis_id"]
    username = payload["username"]
    stream = _STREAMS.get(analysis_id)
    if stream is None or not stream.running:
        return

    df = df_cache.get(analysis_id)
    if df is None:
        return

    row = payload["row"]
    df_cache[analysis_id] = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    stream.row_count = len(df_cache[analysis_id])

    model_update = None
    target = primary_metric_getter(analysis_id)
    if target and row.get(target) is not None:
        model = IncrementalMetricModel(analysis_id, target)
        result = model.update(float(stream.row_count), float(row[target]))
        update_dict = {
            "prediction_before_update": result.prediction_before_update,
            "actual": result.actual,
            "abs_pct_error": result.abs_pct_error,
            "n_updates": result.n_updates,
        }
        catalog.log_model_update(analysis_id, username, target, update_dict)
        model_update = update_dict

    stream.push({"type": "new_row", "row": row, "row_count": stream.row_count, "model_update": model_update})

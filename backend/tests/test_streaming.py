import asyncio
from unittest.mock import AsyncMock, patch

import pandas as pd
import pytest

import streaming
from schema_inference import build_schema


@pytest.fixture(autouse=True)
def _reset_streaming_module_state():
    """_STREAMS and _kafka_unavailable are process-lifetime globals by
    design (see streaming.py) — reset them between tests so one test's
    "Kafka is down" doesn't leak into the next."""
    streaming._STREAMS.clear()
    streaming._PRODUCER_TASKS.clear()
    streaming._kafka_unavailable = False
    streaming._PRODUCER = None
    yield
    streaming._STREAMS.clear()
    streaming._PRODUCER_TASKS.clear()
    streaming._kafka_unavailable = False
    streaming._PRODUCER = None


@pytest.mark.asyncio
async def test_produce_loop_falls_back_to_in_process_delivery_when_kafka_unreachable():
    """This is the exact bug the live deployment hit: row_count stuck at 0
    forever because the broker was unreachable. _get_producer returning
    None (confirmed-unavailable) must make _produce_loop deliver the row
    itself instead of just losing it."""
    df = pd.DataFrame({"Revenue": [100.0, 200.0, 150.0]})
    schema = build_schema(df)
    df_cache = {"a1": df}

    streaming.PRODUCE_INTERVAL_SECONDS = 0.01
    streaming._STREAMS["a1"] = streaming.LiveStream(analysis_id="a1", loop=asyncio.get_running_loop())

    with patch("streaming._get_producer", new=AsyncMock(return_value=None)):
        task = asyncio.create_task(
            streaming._produce_loop("a1", "user1", df_cache, schema, lambda analysis_id: None)
        )
        await asyncio.sleep(0.05)
        streaming._STREAMS["a1"].running = False
        await asyncio.wait_for(task, timeout=1)

    stream = streaming._STREAMS["a1"]
    assert stream.row_count > 3, "row_count never advanced — the in-process fallback didn't run"
    assert len(df_cache["a1"]) == stream.row_count
    assert stream.log[-1]["type"] == "new_row"


@pytest.mark.asyncio
async def test_produce_loop_uses_real_producer_when_kafka_is_reachable():
    df = pd.DataFrame({"Revenue": [100.0]})
    schema = build_schema(df)
    df_cache = {"a1": df}

    streaming.PRODUCE_INTERVAL_SECONDS = 0.01
    streaming._STREAMS["a1"] = streaming.LiveStream(analysis_id="a1", loop=asyncio.get_running_loop())

    fake_producer = AsyncMock()
    with patch("streaming._get_producer", new=AsyncMock(return_value=fake_producer)):
        task = asyncio.create_task(
            streaming._produce_loop("a1", "user1", df_cache, schema, lambda analysis_id: None)
        )
        await asyncio.sleep(0.05)
        streaming._STREAMS["a1"].running = False
        await asyncio.wait_for(task, timeout=1)

    assert fake_producer.send_and_wait.await_count > 0
    # the real broker path hands delivery to the (fake) consumer side, which
    # isn't running here, so row_count must NOT have advanced in-process
    assert streaming._STREAMS["a1"].row_count == 0


@pytest.mark.asyncio
async def test_get_producer_becomes_sticky_unavailable_after_connect_failure():
    with patch("streaming.AIOKafkaProducer") as fake_cls:
        fake_cls.return_value.start = AsyncMock(side_effect=TimeoutError("broker unreachable"))
        first = await streaming._get_producer()
        second = await streaming._get_producer()

    assert first is None
    assert second is None
    assert streaming._kafka_unavailable is True
    # second call must not even try to construct a new producer again
    assert fake_cls.call_count == 1

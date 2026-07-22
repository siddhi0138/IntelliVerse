"""In-memory job registry for streaming analysis progress over WebSocket.

Single-process, single-user local tool: job state lives in memory and is
lost on restart, which is fine at this scale. The heavy analysis itself
runs in a worker thread (it's synchronous CPU-bound pandas/sklearn code),
so progress callbacks fire from that thread. `log` is the single source
of truth (a plain list — appends are atomic under the GIL, no lock
needed); the asyncio.Event is just a threadsafe "something changed"
signal so a WebSocket handler on the event loop can wake up and send
whatever's new since its own cursor, rather than replaying from a
second queue and risking double-delivery.
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field


@dataclass
class Job:
    id: str
    loop: asyncio.AbstractEventLoop
    log: list[dict] = field(default_factory=list)
    status: str = "running"  # running | done | error
    result: dict | None = None
    error: str | None = None
    _event: asyncio.Event = field(default_factory=asyncio.Event)

    def _push(self, message: dict) -> None:
        self.log.append(message)
        self.loop.call_soon_threadsafe(self._event.set)

    def progress(self, step: str) -> None:
        self._push({"type": "progress", "step": step})

    def finish(self, result: dict) -> None:
        self.status = "done"
        self.result = result
        self._push({"type": "done", "result": result})

    def fail(self, detail: str) -> None:
        self.status = "error"
        self.error = detail
        self._push({"type": "error", "detail": detail})

    async def wait_for_update(self) -> None:
        await self._event.wait()
        self._event.clear()


_JOBS: dict[str, Job] = {}


def create_job() -> Job:
    job = Job(id=str(uuid.uuid4()), loop=asyncio.get_event_loop())
    _JOBS[job.id] = job
    return job


def get_job(job_id: str) -> Job | None:
    return _JOBS.get(job_id)

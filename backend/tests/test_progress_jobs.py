import asyncio

import pytest

from progress_jobs import create_job, get_job


@pytest.mark.asyncio
async def test_create_job_is_retrievable_by_id():
    job = create_job()
    assert get_job(job.id) is not None
    assert get_job(job.id) is job


def test_get_job_returns_none_for_unknown_id():
    assert get_job("does-not-exist") is None


@pytest.mark.asyncio
async def test_create_job_starts_in_running_state_with_empty_log():
    job = create_job()
    assert job.status == "running"
    assert job.log == []
    assert job.result is None


@pytest.mark.asyncio
async def test_progress_appends_to_log_without_changing_status():
    job = create_job()
    job.progress("Parsing file")
    assert job.status == "running"
    assert job.log == [{"type": "progress", "step": "Parsing file"}]


@pytest.mark.asyncio
async def test_finish_sets_status_and_result():
    job = create_job()
    job.finish({"rows": 42})
    assert job.status == "done"
    assert job.result == {"rows": 42}
    assert job.log[-1] == {"type": "done", "result": {"rows": 42}}


@pytest.mark.asyncio
async def test_fail_sets_status_and_error():
    job = create_job()
    job.fail("boom")
    assert job.status == "error"
    assert job.error == "boom"
    assert job.log[-1] == {"type": "error", "detail": "boom"}


@pytest.mark.asyncio
async def test_wait_for_update_unblocks_after_progress_is_pushed():
    job = create_job()

    async def push_soon():
        await asyncio.sleep(0.01)
        job.progress("step 1")

    asyncio.create_task(push_soon())
    await asyncio.wait_for(job.wait_for_update(), timeout=1.0)
    assert job.log == [{"type": "progress", "step": "step 1"}]


@pytest.mark.asyncio
async def test_wait_for_update_can_be_awaited_again_for_the_next_push():
    job = create_job()
    job.progress("step 1")
    await job.wait_for_update()  # consumes the already-set event

    async def push_soon():
        await asyncio.sleep(0.01)
        job.progress("step 2")

    asyncio.create_task(push_soon())
    await asyncio.wait_for(job.wait_for_update(), timeout=1.0)
    assert [entry["step"] for entry in job.log] == ["step 1", "step 2"]

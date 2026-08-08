import os

# rate_limit imports auth, which reads JWT_SECRET_KEY at module import time -
# set a default here (before the import below) so this file doesn't need a
# real secret exported, keeping this suite's "no env vars required" property
# intact for everyone else.
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("POSTGRES_DSN", "postgresql://test:test@localhost/test")

from starlette.requests import Request

from rate_limit import _client_ip, _rate_limit_key
from auth import create_access_token


def _fake_request(headers: list[tuple[bytes, bytes]], client_host: str = "10.0.0.1") -> Request:
    scope = {"type": "http", "headers": headers, "client": (client_host, 12345)}
    return Request(scope)


def test_client_ip_prefers_x_forwarded_for_over_client_host():
    # Regression test for a real production bug: behind Render's proxy,
    # request.client.host is the proxy's own (unstable, pooled) hop, not the
    # real caller - per-IP rate limiting silently never accumulated in prod
    # because every request looked like a different "IP", while the exact
    # same code correctly throttled in local tests (whose client.host is
    # always a fixed dummy value). X-Forwarded-For's first hop is the
    # original client and is what actually stays stable per caller.
    request = _fake_request([(b"x-forwarded-for", b"203.0.113.5, 10.0.0.1")], client_host="10.0.0.1")
    assert _client_ip(request) == "203.0.113.5"


def test_client_ip_falls_back_to_client_host_without_x_forwarded_for():
    request = _fake_request([], client_host="203.0.113.5")
    assert _client_ip(request) == "203.0.113.5"


def test_rate_limit_key_uses_ip_when_unauthenticated():
    request = _fake_request([(b"x-forwarded-for", b"203.0.113.5")])
    assert _rate_limit_key(request) == "ip:203.0.113.5"


def test_rate_limit_key_uses_username_from_valid_token():
    token = create_access_token("alice")
    request = _fake_request([(b"authorization", f"Bearer {token}".encode())])
    assert _rate_limit_key(request) == "user:alice"


def test_rate_limit_key_falls_back_to_ip_on_garbage_token():
    request = _fake_request(
        [(b"authorization", b"Bearer not-a-real-jwt"), (b"x-forwarded-for", b"203.0.113.5")]
    )
    assert _rate_limit_key(request) == "ip:203.0.113.5"

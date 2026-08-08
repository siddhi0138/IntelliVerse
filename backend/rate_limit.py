from fastapi import Request
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address

from auth import JWT_ALGORITHM, JWT_SECRET_KEY


def _client_ip(request: Request) -> str:
    """slowapi's own get_remote_address() only ever reads request.client.host
    - behind Render's proxy that's the proxy's own hop, not the real caller,
    and it isn't even stable across requests (Render fronts this with a pool
    of edge nodes), so every request looked like a different "IP" and the
    per-IP limit below never accumulated - confirmed live: 13 straight
    requests to /api/auth/login with none throttled, while the exact same
    code throttled correctly in a local TestClient run (which always reports
    a fixed dummy client.host). X-Forwarded-For's first hop is the original
    client and is what actually stays stable per caller."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


def _rate_limit_key(request: Request) -> str:
    """Key by the calling user when a valid JWT is present, else by IP -
    same reasoning as SentraOps' identical helper: this must never raise,
    since an invalid/missing token here just means the caller isn't
    authenticated yet (e.g. /api/auth/login itself), not a rate-limit error."""
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            username = payload.get("sub")
            if username:
                return f"user:{username}"
        except JWTError:
            pass
    return f"ip:{_client_ip(request)}"


# In-memory storage (no storage_uri) rather than SentraOps' Redis-backed
# limiter: this app runs as a single Render instance, not multiple
# pods/replicas, so there's no cross-process count that needs to stay in
# sync - the distributed-storage problem a Redis backend solves doesn't
# apply here, and this project has no Redis instance provisioned at all.
limiter = Limiter(key_func=_rate_limit_key)

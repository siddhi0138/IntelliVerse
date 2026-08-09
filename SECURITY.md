# Security

How IntelliVerse handles auth, secrets, and abuse prevention — and where it deliberately draws the line, given this is a portfolio project rather than a paid product with a security team behind it.

## Authentication

- Passwords are hashed with **bcrypt** (`backend/auth.py`), never stored or logged in plaintext.
- Sessions are **JWTs** signed with `JWT_SECRET_KEY`, which must be set to a real random value in production (`python -c "import secrets; print(secrets.token_hex(32))"`) — there's no insecure default here, so a forgotten env var fails loudly (a `KeyError` at startup) instead of silently running with a guessable key.
- The frontend stores the access token in `localStorage` (`frontend/lib/auth.ts`), not an httpOnly cookie — a deliberate tradeoff common to token-based SPA/API pairs (no CSRF handling needed), but it does mean a successful XSS on the frontend could read it.

## Rate limiting

In-memory rate limiting (`backend/rate_limit.py`, via `slowapi`), keyed by authenticated username when a valid JWT is present, otherwise by IP — so it still protects unauthenticated endpoints like login, not just logged-in traffic. The IP itself is read from `X-Forwarded-For`'s first hop, not the raw connection IP, since this runs behind Render's reverse proxy — using the raw connection IP was tried first and shipped a real bug (the per-IP limit silently never accumulated in production, since every request appeared to come from a different proxy hop) before being caught and fixed.

Applied to auth endpoints (brute-force protection) and every LLM-calling / heavy-compute endpoint (cost and latency protection), not blanket-applied to the whole API, since the frontend legitimately polls several read-only endpoints frequently:

| Endpoint(s) | Limit | Why |
|---|---|---|
| `/api/auth/login`, `/api/auth/register` | 10/min | brute-force protection |
| `/api/analyze`, `/api/analyze/start`, `/api/analyze/{id}/refresh`, `/api/workspace`, `/api/documents` | 10/min | uploads + a multi-model forecast backtest, genuinely expensive per call |
| `/api/simulate`, `/api/optimize`, `/api/workspace/{id}/simulate-entity` | 10/min | non-trivial computation |
| `/api/forecast` | 10/min | fits multiple models per call |
| `/api/ask`, `/api/ask-documents`, `/api/simulate/explain`, `/api/forecast/explain`, `/api/summary`, `/api/anomalies/explain`, `/api/action-plan` | 20/min | LLM API cost/latency protection |

This is in-memory rather than Redis-backed (unlike this developer's other project, SentraOps, which runs multiple pods and needs shared counters): this backend runs as a single Render instance, so there's no cross-process count to keep in sync, and adding a new Redis dependency purely for this would be unjustified complexity.

## Secrets

No credentials are committed to the repo — `.env` is gitignored; only `.env.example` (with placeholder values) is tracked. `JWT_SECRET_KEY` has no code-level fallback (`os.environ["JWT_SECRET_KEY"]` in `auth.py`, not `.get()`), so leaving it *unset* fails loudly with a `KeyError` at startup rather than quietly running with a weak key — but this only helps if it's unset: copying `.env.example` to `.env` without actually replacing the placeholder value would run fine with that known, public string as the real signing key. The setup instructions call out generating a real one; the code itself can't tell a real secret from an unedited placeholder. CI never needs real secrets: the backend test suite runs entirely against in-memory pandas DataFrames and never imports `catalog.py`, `auth.py`, or `main.py` (see `tests/conftest.py`).

## CORS

`FRONTEND_ORIGINS` is an explicit comma-separated allowlist (default `http://localhost:3000` for local dev) — never a wildcard `*`, so a production deployment must name its real frontend origin(s) or browser requests are rejected.

## Dependency & container scanning

- **Dependabot** (`.github/dependabot.yml`) watches the backend's pip packages, the frontend's npm packages, GitHub Actions versions, and the base images of both Dockerfiles plus the Grafana image — monthly, with minor/patch updates grouped into a single PR per ecosystem and major-version bumps excluded (those need a real look, not a rubber-stamp merge — an early major-bump PR here broke on a real transitive-dependency conflict a CI check caught before it could be merged).
- **Trivy** (`.github/workflows/security.yml`) builds the backend and frontend images and scans them for CRITICAL/HIGH CVEs on every push to `master` plus a weekly schedule, uploading results to GitHub's Security tab (SARIF). It doesn't fail the build on findings — base-image CVEs are often outside this project's control to fix immediately — but it makes them visible instead of invisible.

## What's deliberately out of scope

This is a solo portfolio project, not a fielded product: there's no bug bounty, no pen test, and no compliance audit trail behind these claims — they describe what the code actually does, verified by reading it and by testing it against the real deployment, not a compliance posture.

## Reporting an issue

This is a personal project — open a GitHub issue, or reach out directly, and I'll fix it as fast as I can.

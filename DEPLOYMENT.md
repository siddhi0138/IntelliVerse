# Deployment

Moved out of the main README to keep that one scannable — this is the full
reference for standing up your own copy in production, entirely on free
tiers, verified live rather than assumed.

The backend (in-memory caches, WebSockets, Neo4j/Postgres connections, heavy ML
deps) doesn't fit a serverless platform, so frontend and backend deploy
separately:

### Frontend → Vercel
1. Import this repo, set the project root to `frontend/`.
2. Set `NEXT_PUBLIC_API_BASE` to your deployed backend's URL — **before your
   first build**, or before any build you want it to take effect in. Next.js
   bakes `NEXT_PUBLIC_*` variables into the client-side JS at *build* time,
   not at request time — setting it in Vercel's dashboard after the fact
   does nothing until you trigger a new deploy. Skip this and every visitor's
   browser tries to call `http://localhost:8001` (the dev fallback) instead
   of your real backend — every request fails, with no obvious error beyond
   "can't reach localhost." If this happens, the app itself now logs a clear
   console error naming the problem, but only after you've deployed with it
   missing at least once — so it's worth double-checking this variable
   *before* your first production build, not after debugging a broken deploy.
3. Vercel auto-detects Next.js — no further config needed.

### Backend → Render
1. Create a **Web Service** from this repo, root directory `backend/` — Render
   detects `Dockerfile` and builds/deploys it directly.
2. **Postgres: use Neon, not Render Postgres.** Render's free Postgres
   instances expire 30 days after creation (14-day grace period, then the
   database — and everything in it — is deleted unless upgraded to a paid
   plan); that's a real risk for `catalog.py`'s whole reason for existing.
   [Neon](https://neon.tech) has a genuinely permanent free tier instead (no
   card, no expiry, 0.5GB/project) — sign up, create a project, and copy its
   connection string (already includes `?sslmode=require`; `psycopg2`
   accepts it as-is, no code change needed). This backs both auth *and* the
   dataset catalog — every dataset, saved forecast/simulation/optimization/
   query, ask-history exchange, and incremental-learning update lives here,
   not on the backend's own disk. Neon's compute scales to zero after 5 min
   idle, so expect a short cold-start on the first query after inactivity,
   same tradeoff as Render's own free web services.
3. **Neo4j: use AuraDB Free, not a self-hosted Render service.** Render's
   free web services can't attach a persistent disk at all — disks require
   a paid instance type — so a self-hosted Neo4j-on-Render "free" service is
   actually either silently billed or has no real persistent disk (data
   doesn't survive a restart) depending on how it's configured. [Neo4j
   AuraDB Free](https://neo4j.com/product/auradb/) is Neo4j's own perpetual
   free tier instead (no card, no expiry, one instance, 200k nodes/400k
   relationships) — sign up, create a free instance, and it gives you a
   `neo4j+s://...` connection URI plus a one-time-shown password. The
   `neo4j` Python driver accepts that URI scheme natively, so `NEO4J_URI`
   just changes value, no code change needed.
4. Add the environment variables below to the backend Web Service.
5. Real-time streaming (Kafka) is **not** part of this Render setup by
   default — Kafka only runs inside the local `docker-compose` stack, and
   Render hosts just the one backend web service, no broker alongside it.
   Without it, the backend retries connecting (with capped exponential
   backoff, not a fixed 5s hammer) and logs a warning periodically, but the
   "Go live" feature genuinely won't work. To make it work on Render too,
   sign up for a free hosted Kafka (e.g. **Aiven for Apache Kafka** — a
   genuinely free tier, no trial expiry, though it auto-pauses after 24h of
   inactivity and needs a manual "power on" from Aiven's console) and add
   the variables below — a hosted broker needs login credentials over an
   encrypted connection, unlike the unauthenticated local one, which is
   exactly what those variables are for.
6. Knowledge Assistant's document vectors (Qdrant) also default to
   on-disk mode inside the backend container — fine locally, but reset on
   every Render redeploy. Sign up for a free [Qdrant
   Cloud](https://qdrant.tech/cloud/) cluster (permanently free, no card)
   and add `QDRANT_URL`/`QDRANT_API_KEY` below to point at it instead.

**Environment variables to add on Render:**

| Variable | Value |
|---|---|
| `FRONTEND_ORIGINS` | Your Vercel domain, e.g. `https://your-app.vercel.app` (comma-separate if you have more than one) |
| `FREELLMAPI_BASE_URL` | Your LLM endpoint's base URL — must be a real, publicly reachable endpoint. `localhost` (even the code's own default) means "this container," not your laptop, so a local Ollama only works if it's likewise reachable, e.g. via a tunnel — most deployments point this at a real hosted LLM instead |
| `FREELLMAPI_API_KEY` | Your LLM endpoint's API key |
| `FREELLMAPI_MODEL` | `auto` (or a specific model name) |
| `NEO4J_URI` | Your AuraDB Free instance's URI, e.g. `neo4j+s://xxxxxxxx.databases.neo4j.io` |
| `NEO4J_USER` | `neo4j` |
| `NEO4J_PASSWORD` | The password AuraDB shows you once at instance creation — save it, it isn't shown again |
| `POSTGRES_DSN` | Your Neon project's connection string (includes `?sslmode=require`) |
| `JWT_SECRET_KEY` | Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_EXPIRE_MINUTES` | `1440` |
| `QDRANT_URL` *(optional)* | A hosted Qdrant instance's URL, e.g. a free [Qdrant Cloud](https://qdrant.tech/cloud/) cluster's endpoint. Leave unset and Knowledge Assistant falls back to on-disk mode on the backend's own (ephemeral) disk |
| `QDRANT_API_KEY` *(optional)* | That cluster's API key |
| `KAFKA_BOOTSTRAP_SERVERS` *(optional)* | Only if using a hosted Kafka, e.g. `<service-name>.aivencloud.com:<port>` |
| `KAFKA_SECURITY_PROTOCOL` *(optional)* | `SASL_SSL` |
| `KAFKA_SASL_MECHANISM` *(optional)* | `SCRAM-SHA-256` |
| `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD` *(optional)* | From your Kafka provider's console |
| `KAFKA_SSL_CA_CERT` *(optional)* | The provider's CA Certificate download, pasted as-is (real or `\n`-escaped newlines both work) — needed for providers (like Aiven) that sign their server certificate with a private CA |

### Monitoring → Render (Prometheus + Grafana)

Render's "deploy an existing image" path only accepts flat **Secret Files**
(no subdirectories), which can't reproduce Grafana's `datasources/` +
`dashboards/` provisioning structure — so the two services are set up
differently:

1. **Prometheus**: New Web Service → **"Deploy an existing image from a
   registry"** → image `prom/prometheus:v3.6.0`. Add a Secret File named
   `prometheus.yml` (just the filename — Render mounts it at
   `/etc/secrets/prometheus.yml`) with the contents of
   `monitoring/prometheus.prod.yml` (scrapes your real backend URL over
   HTTPS, not the docker-compose internal hostname). Set the service's
   **Docker Command** to
   `--config.file=/etc/secrets/prometheus.yml --storage.tsdb.path=/prometheus`
   — Render's Docker Command replaces the launch command entirely, so the
   binary path must be included, not just the flags.
2. **Grafana**: New Web Service → **"Build and deploy from a Git
   repository"** (not an existing image) → root directory
   `monitoring/grafana-prod`. This builds a tiny image from the repo's own
   Dockerfile that copies in the same dashboard as local dev, pre-pointed
   at your deployed Prometheus service's URL. Add environment variable
   `GF_SECURITY_ADMIN_PASSWORD` to whatever you want the admin login to be.
3. Both are genuinely free-tier services with no persistent disk — restarts
   don't lose anything meaningful since the whole setup is provisioned from
   files in the repo, not manual UI configuration; only historical metrics
   (not the dashboard itself) reset on a restart.

### What still doesn't survive a Render restart

Nothing, anymore. Datasets, saved forecasts/simulations/optimizations/
queries, ask history, and the incremental-learning model's actual learned
weights (not just their history) all live in Postgres now — a backend
redeploy loses none of it. The two gaps that used to exist here are both
closed:

- **Qdrant** (Knowledge Assistant's document vectors) — set `QDRANT_URL`
  (and `QDRANT_API_KEY` if required) to point at a hosted instance, e.g. a
  free [Qdrant Cloud](https://qdrant.tech/cloud/) cluster (permanently
  free, 1GB RAM/4GB disk, no card — auto-suspends after 1 week of
  inactivity and deletes after 4 weeks, so touch it at least that often).
  Leave both unset for local dev and `document_intelligence.py` keeps using
  on-disk mode under `backend/data/qdrant`, same as before.
- **Incremental-learning model weights** — `incremental_model.py` now
  serializes its (tiny, a few KB) scikit-learn state as a BYTEA row via
  `catalog.save_model_weights`/`load_model_weights`, reusing the Postgres
  instance already backing everything else instead of a file on disk. The
  model resumes exactly where it left off after a redeploy instead of
  restarting from scratch.

### Avoiding cold starts (optional)

Render's free web services spin down after 15 minutes of no traffic and take
20-50s to wake on the next request — the actual, honest cost of $0/month
hosting. This gets compounded across three separate free services here
(backend, Prometheus, Grafana): if Prometheus wakes up and tries its next
scrape cycle while the backend happens to be asleep, that scrape fails and
the Grafana dashboard shows "no data" until both happen to be awake at the
same time.

**Don't "fix" this by pinging every service to keep it always-on.** Render's
free tier gives **750 instance-hours per month, shared across every free
service in the workspace** — not per service. A month is ~730-744 hours by
itself, so keeping even one service alive 24/7 eats almost the entire shared
pool, and exceeding it **suspends every free service in the workspace until
the next month**, which is far worse than an occasional cold start.

What's actually safe: keep just the backend warm during the hours it's
realistically used, and let everything sleep overnight. This repo pings
itself via [`.github/workflows/keep-alive.yml`](.github/workflows/keep-alive.yml)
(unmetered on a public repo, and a failed run just shows red in the Actions
tab instead of silently disabling itself) on schedule `*/10 6-23 * * *`
(every 10 minutes, 6 AM-11:59 PM UTC), costing about 480 hours/month for the
backend — comfortably inside the 750-hour shared budget, with ~270 hours
left over for Prometheus and Grafana's normal sleep/wake cycles. A
third-party cron service (e.g. [cron-job.org](https://cron-job.org/))
hitting the same `GET /api/health` works too, but its bot-check heuristics
have occasionally flagged the ping itself as suspicious traffic and
auto-disabled the whole schedule after a few failures - worth having the
Actions workflow as the one that can't quietly stop working unnoticed.
`/api/health` needs no auth token, so no credentials are involved either way.

Live at [intelli-verse-phi.vercel.app](https://intelli-verse-phi.vercel.app) — the
Vercel project is git-connected (auto-deploys on push to `master`); the Render
backend auto-deploys via a CI step that calls Render's Deploy Hook after
tests pass (`.github/workflows/ci.yml`) — Render's own GitHub webhook
integration for this service stopped firing, so CI triggers the deploy
directly instead of depending on it. To run your own copy, follow the steps
above with your own Vercel/Render accounts.

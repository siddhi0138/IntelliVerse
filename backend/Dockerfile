FROM python:3.13-slim

# build-essential + cmake: prophet's cmdstanpy backend compiles cmdstan from
# source if no prebuilt binary matches this platform; without a toolchain
# that would fail on first forecast request instead of at build time.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Do this once at build time rather than on the container's first forecast
# request, where a multi-minute compile would look like a hang.
RUN python -c "import cmdstanpy; cmdstanpy.install_cmdstan()"

COPY . .
RUN mkdir -p data

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]

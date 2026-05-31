# Python API — multi-stage build for lean production image
FROM python:3.12-slim AS base

# System deps for Playwright (Chromium headless browser for RPA)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    gnupg \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
RUN pip install --no-cache-dir uv

WORKDIR /app

# ── Dependencies layer (cached unless pyproject.toml changes) ─────────────────
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# ── Application code ──────────────────────────────────────────────────────────
COPY . .

# Install Playwright's Chromium browser for RPA auto-apply
RUN uv run playwright install chromium

# ── Runtime ───────────────────────────────────────────────────────────────────
EXPOSE 8000

# 4 workers: 1 per CPU core (typical 2-4 core container)
# --forwarded-allow-ips: required when behind a reverse proxy
CMD ["uv", "run", "uvicorn", "api.server:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--forwarded-allow-ips", "*"]

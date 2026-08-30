# Registrar — ERC-8004 testnet register service (FastAPI + web3 + BNBAgent SDK).
# Deployed as a Render "web service" (Docker). Binds to $PORT (Render injects it;
# defaults to 8080 for local `docker run`).
FROM python:3.12-slim

# web3 / eth-account wheels are prebuilt, but keep build tools available in case a
# transitive dep needs to compile on this platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Documented default; Render overrides with its own $PORT.
ENV PORT=8080
EXPOSE 8080

# Shell form so $PORT expands. --proxy-headers: Render terminates TLS upstream.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers"]

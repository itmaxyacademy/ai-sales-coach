# =====================================================
# Dockerfile — BackendTTS (Supertonic TTS / FastAPI)
# Target: VPS via docker-compose
# =====================================================

FROM python:3.11-slim

# ── System Dependencies ───────────────────────────
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Working Directory ─────────────────────────────
WORKDIR /app

# ── Install Python Dependencies ───────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Copy Source ───────────────────────────────────
COPY main.py .

# ── Model Cache (di-mount sebagai volume di compose) ─
# Catatan: jangan mkdir di sini — Docker volume akan buat folder otomatis
# Path ini diset via ENV agar supertonic tahu lokasi cache
ENV SUPERTONIC_CACHE_DIR=/app/models/cache

# ── Port ──────────────────────────────────────────
EXPOSE 5001

# ── Start ─────────────────────────────────────────
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]

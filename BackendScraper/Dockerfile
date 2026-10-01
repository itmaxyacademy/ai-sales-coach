# ─────────────────────────────────────────────
# Stage: Build & Runtime (single-stage)
# Base: python:3.11-slim
# ─────────────────────────────────────────────
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# ─────────────────────────────────────────────
# Install system dependencies
# Required by native document-processing dependencies.
# ─────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libssl-dev \
    libffi-dev \
    libxml2-dev \
    libxslt1-dev \
    libjpeg-dev \
    libpng-dev \
    libmupdf-dev \
    zlib1g-dev \
    curl \
    wget \
    ca-certificates \
    gnupg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────
# Install Python dependencies
# ─────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ─────────────────────────────────────────────
# Copy application source files
# ─────────────────────────────────────────────
COPY main.py .
COPY extractors.py .

# ─────────────────────────────────────────────
# Expose application port
# ─────────────────────────────────────────────
EXPOSE 8001

# ─────────────────────────────────────────────
# Start the FastAPI application via Uvicorn
# ─────────────────────────────────────────────
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]

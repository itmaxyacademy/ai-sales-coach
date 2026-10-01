from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, validator
from bs4 import BeautifulSoup
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import ipaddress
import os
from pathlib import Path
from urllib.parse import urlparse

from extractors import _download_bytes, extract_text_from_bytes, extract_text_from_url

# ─── RATE LIMITER ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Sales AI Coach Scraper Service")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS (dibatasi, hanya dari frontend yang dikenal) ────────────────────────
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3002,http://localhost:5100"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)

# ─── KONSTANTA BATASAN ────────────────────────────────────────────────────────
MAX_FILE_SIZE_BYTES  = 10 * 1024 * 1024   # 10 MB
MAX_SCRAPE_TEXT_LEN  = 12_000             # karakter
MAX_EXTRACT_TEXT_LEN = 20_000             # karakter
SCRAPE_TIMEOUT_SECS  = 10                 # detik

# ─── HELPER: Validasi URL (cegah SSRF) ───────────────────────────────────────
def validate_url(url: str) -> None:
    """
    Pastikan URL:
    1. Menggunakan skema https:// saja
    2. Tidak mengarah ke IP private/loopback (SSRF prevention)
    3. Punya hostname yang valid
    """
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="URL tidak valid.")

    # Hanya izinkan HTTPS
    if parsed.scheme not in ("https",):
        raise HTTPException(
            status_code=400,
            detail="Hanya URL dengan skema https:// yang diizinkan."
        )

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="URL tidak memiliki hostname yang valid.")

    # Blokir localhost dan nama host internal
    blocked_hostnames = {"localhost", "host.docker.internal"}
    if hostname.lower() in blocked_hostnames:
        raise HTTPException(status_code=400, detail="URL mengarah ke host yang tidak diizinkan.")

    # Resolve domains too; block any non-public answer to prevent DNS-based SSRF.
    try:
        import socket
        addresses = socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
            raise HTTPException(status_code=400, detail="URL mengarah ke alamat jaringan non-publik.")
    except OSError:
        raise HTTPException(status_code=400, detail="Hostname URL tidak dapat di-resolve.")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="URL mengarah ke alamat jaringan non-publik.") from exc


# ─── MODELS ───────────────────────────────────────────────────────────────────
class ScrapeRequest(BaseModel):
    url: str

    @validator("url")
    def url_must_be_https(cls, v):
        if not v.startswith("https://"):
            raise ValueError("Hanya URL https:// yang diizinkan.")
        return v


class ExtractRequest(BaseModel):
    url: str

    @validator("url")
    def url_must_be_https(cls, v):
        if not v.startswith("https://"):
            raise ValueError("Hanya URL https:// yang diizinkan.")
        return v


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────
@app.post("/scrape")
@limiter.limit("10/minute")
def scrape_url(req: ScrapeRequest, request: Request):
    """
    Scrape halaman web dan kembalikan teks kontennya.
    Batasan:
    - Hanya HTTPS
    - Tidak boleh mengarah ke IP/host internal (anti-SSRF)
    - Max 10 request/menit per IP
    - Teks dibatasi 12.000 karakter
    """
    validate_url(req.url)
    try:
        html = _download_bytes(req.url).decode("utf-8", errors="replace")
        soup = BeautifulSoup(html, "html.parser")
        texts = [text.strip() for element in soup.select("h1, h2, h3, h4, p, li, span")
                 if (text := element.get_text(" ", strip=True)) and len(text.strip()) > 10]

        unique_texts = list(dict.fromkeys(texts))
        full_text = "\n".join(unique_texts)

        return {"url": req.url, "text": full_text[:MAX_SCRAPE_TEXT_LEN]}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Gagal mengambil atau membaca URL.")


@app.post("/extract")
@limiter.limit("10/minute")
def extract_file(req: ExtractRequest, request: Request):
    """
    Ekstrak teks dari file yang diunduh dari URL.
    Batasan:
    - Hanya HTTPS
    - Max 10 request/menit per IP
    - Teks dibatasi 20.000 karakter
    """
    validate_url(req.url)
    try:
        text = extract_text_from_url(req.url)
        return {"url": req.url, "text": text[:MAX_EXTRACT_TEXT_LEN]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/extract-file")
@limiter.limit("10/minute")
async def extract_uploaded_file(request: Request, file: UploadFile = File(...)):
    """
    Ekstrak teks dari file yang di-upload langsung.
    Batasan:
    - Ukuran file maks 10 MB
    - Max 10 request/menit per IP
    - Teks dibatasi 20.000 karakter
    """
    filename = file.filename or "upload.bin"
    allowed_extensions = {".txt", ".md", ".csv", ".tsv", ".json", ".log", ".rtf", ".html", ".htm", ".pdf", ".docx", ".xlsx", ".xls", ".ods", ".pptx", ".ppt", ".odt", ".epub"}
    if Path(filename).suffix.lower() not in allowed_extensions:
        raise HTTPException(status_code=415, detail="Format file tidak didukung.")
    content = await file.read(MAX_FILE_SIZE_BYTES + 1)
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Ukuran file melebihi batas maksimum 10 MB.")

    try:
        text = extract_text_from_bytes(filename, content)
        return {"filename": file.filename, "text": text[:MAX_EXTRACT_TEXT_LEN]}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

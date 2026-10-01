import os
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import edge_tts
import uvicorn

app = FastAPI(title="Sales AI Coach TTS Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VOICE_MAP = {
    # Indonesian
    "id": {
        "female": ["id-ID-GadisNeural"],
        "male": ["id-ID-ArdiNeural"],
    },
    # English
    "en": {
        "female": ["en-US-JennyNeural", "en-US-AriaNeural"],
        "male": ["en-US-GuyNeural", "en-US-ChristopherNeural"],
    }
}

LEGACY_VOICES = {
    "M1": "id-ID-ArdiNeural",
    "M2": "id-ID-ArdiNeural",
    "M3": "en-US-GuyNeural",
    "M4": "en-US-ChristopherNeural",
    "M5": "id-ID-ArdiNeural",
    "F1": "id-ID-GadisNeural",
    "F2": "en-US-JennyNeural",
    "F3": "id-ID-GadisNeural",
}

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice: str = "M1"
    gender: str = ""
    lang: str = "id"

def resolve_voice(req: TTSRequest) -> str:
    lang = "en" if req.lang.lower().startswith("en") else "id"
    gender = req.gender.upper() if req.gender else ("F" if req.voice.startswith("F") else "M")
    gender_key = "female" if gender == "F" else "male"

    if lang == "id":
        return VOICE_MAP["id"][gender_key][0]

    voices = VOICE_MAP["en"][gender_key]
    voice_number = int(req.voice[1:]) if req.voice[1:].isdigit() else 1
    return voices[(voice_number - 1) % len(voices)]

from starlette.background import BackgroundTask

@app.post("/synthesize")
async def synthesize(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    selected_voice = resolve_voice(req)
    
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp.close()

    try:
        communicate = edge_tts.Communicate(req.text, selected_voice)
        await communicate.save(tmp.name)

        def remove_temp_file(path: str):
            try:
                if os.path.exists(path):
                    os.unlink(path)
            except Exception:
                pass

        response = FileResponse(
            tmp.name, 
            media_type="audio/mpeg", 
            filename="tts.mp3",
            background=BackgroundTask(remove_temp_file, tmp.name)
        )
        response.headers["X-Voice-Used"] = selected_voice
        return response
    except Exception as e:
        if os.path.exists(tmp.name):
            try: os.unlink(tmp.name)
            except: pass
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/voices")
def get_voices():
    return {
        "voices": list(LEGACY_VOICES.keys()),
        "mapping": LEGACY_VOICES,
    }

@app.get("/health")
def health():
    return {"status": "ok", "service": "edge-tts"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    uvicorn.run(app, host="0.0.0.0", port=port)

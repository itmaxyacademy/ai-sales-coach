import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// ---------------------------------------------------------------------------
// Bahasa Indonesia phoneme-to-viseme mapping
// ---------------------------------------------------------------------------

type VisemeTuple = [string, number]; // [shape, intensity]

const DIGRAPH_MAP: Record<string, VisemeTuple> = {
  ng: ["aa", 0.25],
  ny: ["ih", 0.30],
  kh: ["aa", 0.20],
  sy: ["ee", 0.30],
};

const PHONEME_MAP: Record<string, VisemeTuple> = {
  // Vowels (Open mouth shapes)
  a: ["aa", 0.82],
  i: ["ih", 0.72],
  u: ["ou", 0.78],
  e: ["ee", 0.65],
  o: ["oh", 0.75],
  // Bilabial consonants (closed lips / mouth press)
  m: ["pp", 0.55],
  b: ["pp", 0.50],
  p: ["pp", 0.60],
  // Labiodental (teeth on lip)
  f: ["ff", 0.50],
  v: ["ff", 0.45],
  // Alveolar / Dental / Sibilant (narrow mouth)
  t: ["ih", 0.35],
  d: ["ih", 0.35],
  n: ["ih", 0.30],
  l: ["ee", 0.38],
  r: ["ee", 0.35],
  s: ["ih", 0.45],
  z: ["ih", 0.40],
  c: ["ee", 0.42],
  j: ["ee", 0.42],
  // Velar / Glottal
  k: ["aa", 0.35],
  g: ["aa", 0.35],
  h: ["aa", 0.28],
  // Semivowels
  w: ["ou", 0.55],
  y: ["ih", 0.50],
};

const FALLBACK_VISEME: VisemeTuple = ["aa", 0.20];

/**
 * Splits Bahasa Indonesia text into an array of viseme tuples.
 * Preserves phonemes and brief pauses for spaces/punctuation.
 */
function parseIndonesianPhonemes(text: string): VisemeTuple[] {
  const clean = text.toLowerCase();
  const result: VisemeTuple[] = [];

  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];

    if (/\s|[,.!?;:-]/.test(ch)) {
      result.push(["rest", 0]);
      i += 1;
      continue;
    }

    if (!/[a-z]/.test(ch)) {
      i += 1;
      continue;
    }

    // Check for digraph first
    if (i + 1 < clean.length) {
      const digraph = clean[i] + clean[i + 1];
      if (DIGRAPH_MAP[digraph]) {
        result.push(DIGRAPH_MAP[digraph]);
        i += 2;
        continue;
      }
    }

    // Single character lookup
    result.push(PHONEME_MAP[ch] ?? FALLBACK_VISEME);
    i += 1;
  }

  return result;
}

interface QueueItem {
  arrayBuffer: ArrayBuffer | null;
  text: string;
  ready: boolean;
  onViseme?: {
    text: string;
    callback: (shape: string, intensity: number) => void;
  };
}

// ---------------------------------------------------------------------------
// useTTS hook
// ---------------------------------------------------------------------------

export type TTSEngine = "edge" | "edge-cache" | "piper" | "webspeech" | null;

interface VisemeSchedule {
  startTime: number;
  endTime: number;
  phonemes: VisemeTuple[];
  callback: (shape: string, intensity: number) => void;
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [engine, setEngine] = useState<TTSEngine>(null);
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const [activeVoice, setActiveVoice] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const isSpeakingRef = useRef(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const synthSpeakingCountRef = useRef(0);
  const activeSchedulesRef = useRef<VisemeSchedule[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const setSpeakingState = useCallback((speaking: boolean) => {
    isSpeakingRef.current = speaking;
    setIsSpeaking(speaking);
  }, []);

  const initAudioCtx = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  // Clock-driven frame-accurate viseme sync loop
  const tickVisemes = useCallback(function tickVisemes() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const currentTime = ctx.currentTime;

    activeSchedulesRef.current = activeSchedulesRef.current.filter((schedule) => {
      // Audio clip has ended: immediately set mouth to rest position
      if (currentTime >= schedule.endTime) {
        schedule.callback("rest", 0);
        return false;
      }

      // Audio clip is currently playing: compute exact phoneme at current millisecond
      if (currentTime >= schedule.startTime) {
        const progress = Math.min(
          1,
          Math.max(0, (currentTime - schedule.startTime) / (schedule.endTime - schedule.startTime))
        );
        const index = Math.min(
          schedule.phonemes.length - 1,
          Math.floor(progress * schedule.phonemes.length)
        );
        const [shape, intensity] = schedule.phonemes[index];
        schedule.callback(shape, intensity);
      }
      return true;
    });

    if (activeSchedulesRef.current.length > 0) {
      animFrameRef.current = requestAnimationFrame(tickVisemes);
    } else {
      animFrameRef.current = null;
    }
  }, []);

  // Web Speech API Fallback with strict gender verification
  const speakWithWebSpeech = useCallback((text: string, gender: string = "M", lang: string = "id") => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    try {
      setEngine("webspeech");
      const utterance = new SpeechSynthesisUtterance(text);
      const isEnglish = lang.toLowerCase().startsWith("en");
      utterance.lang = isEnglish ? "en-US" : "id-ID";

      const voices = window.speechSynthesis.getVoices();
      const targetLang = isEnglish ? "en" : "id";
      const isFemale = gender.toUpperCase() === "F";

      const FEMALE_NAMES = ["female", "gadis", "zira", "jenny", "siti", "wanita", "samantha", "victoria", "karen", "susan", "cortana"];
      const MALE_NAMES   = ["male", "ardi", "david", "guy", "pria", "laki", "george", "mark", "richard", "james", "john", "paul"];

      const targetVoices = voices.filter(v => v.lang.toLowerCase().startsWith(targetLang));
      const pool = targetVoices.length > 0 ? targetVoices : voices;

      // Strict matching based on avatar gender
      let matchedVoice: SpeechSynthesisVoice | undefined;
      if (isFemale) {
        matchedVoice = pool.find(v => FEMALE_NAMES.some(k => v.name.toLowerCase().includes(k)));
        if (matchedVoice) {
          setVoiceWarning(null);
        } else {
          matchedVoice = pool[0];
          setVoiceWarning("Suara cewek tidak tersedia, memakai suara cadangan");
        }
      } else {
        matchedVoice = pool.find(v => MALE_NAMES.some(k => v.name.toLowerCase().includes(k)));
        if (matchedVoice) {
          setVoiceWarning(null);
        } else {
          matchedVoice = pool[0];
          setVoiceWarning("Suara cowok tidak tersedia, memakai suara cadangan");
        }
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
        setActiveVoice(matchedVoice.name);
      } else {
        setActiveVoice("WebSpeech Default");
      }

      // Pitch tuning - distinct male and female pitch
      utterance.pitch = isFemale ? 1.2 : 0.7;
      utterance.rate  = 1.0;

      utterance.onstart = () => {
        synthSpeakingCountRef.current++;
        setSpeakingState(true);
      };

      utterance.onend = () => {
        synthSpeakingCountRef.current = Math.max(0, synthSpeakingCountRef.current - 1);
        if (synthSpeakingCountRef.current === 0 && queueRef.current.length === 0) {
          setSpeakingState(false);
        }
      };

      utterance.onerror = () => {
        synthSpeakingCountRef.current = Math.max(0, synthSpeakingCountRef.current - 1);
        if (synthSpeakingCountRef.current === 0 && queueRef.current.length === 0) {
          setSpeakingState(false);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("[TTS] WebSpeech fallback error:", e);
      setSpeakingState(false);
    }
  }, [setSpeakingState]);

  const scheduleReadyItems = useCallback(async (gender: string = "M", lang: string = "id") => {
    initAudioCtx();
    const ctx = audioCtxRef.current;
    if (!ctx) {
      // If no AudioContext, fallback to WebSpeech
      while (queueRef.current.length > 0) {
        const item = queueRef.current.shift()!;
        speakWithWebSpeech(item.text, gender, lang);
      }
      return;
    }
    
    while (queueRef.current.length > 0 && queueRef.current[0].ready) {
      const item = queueRef.current.shift()!;
      
      if (!item.arrayBuffer || item.arrayBuffer.byteLength === 0) {
        // Fallback to Web Speech API
        speakWithWebSpeech(item.text, gender, lang);
        continue;
      }

      try {
        const audioBuffer = await ctx.decodeAudioData(item.arrayBuffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        const currentTime = ctx.currentTime;
        if (nextStartTimeRef.current < currentTime) {
          nextStartTimeRef.current = currentTime + 0.05;
        }

        const startTime = nextStartTimeRef.current;
        const endTime = startTime + audioBuffer.duration;

        source.start(startTime);
        nextStartTimeRef.current = endTime;
        activeSourcesRef.current.push(source);
        setSpeakingState(true);

        // Attach frame-accurate viseme schedule
        if (item.onViseme) {
          const phonemes = parseIndonesianPhonemes(item.onViseme.text);
          activeSchedulesRef.current.push({
            startTime,
            endTime,
            phonemes,
            callback: item.onViseme.callback,
          });

          if (!animFrameRef.current) {
            animFrameRef.current = requestAnimationFrame(tickVisemes);
          }
        }

        source.onended = () => {
          activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
          if (activeSourcesRef.current.length === 0 && queueRef.current.length === 0 && synthSpeakingCountRef.current === 0) {
            setSpeakingState(false);
          }
        };
      } catch (e) {
        console.warn("[TTS] AudioContext decode failed, falling back to WebSpeech:", e);
        speakWithWebSpeech(item.text, gender, lang);
      }
    }
  }, [initAudioCtx, setSpeakingState, speakWithWebSpeech, tickVisemes]);

  const speak = useCallback(async (
    text: string,
    voice: string = "M1",
    gender: string = "M",
    lang: string = "id",
    onViseme?: (shape: string, intensity: number) => void
  ) => {
    if (!isEnabled || !text.trim()) return;

    initAudioCtx();

    const trimmed = text.trim();
    const queueItem: QueueItem = {
      arrayBuffer: null,
      text: trimmed,
      ready: false,
      ...(onViseme ? { onViseme: { text: trimmed, callback: onViseme } } : {}),
    };
    queueRef.current.push(queueItem);

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${BASE_URL}/tts/synthesize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: trimmed,
          voice,
          gender,
          lang,
        }),
      });

      if (!response.ok) {
        queueItem.ready = true;
        scheduleReadyItems(gender, lang);
        return;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("audio")) {
        queueItem.ready = true;
        scheduleReadyItems(gender, lang);
        return;
      }

      const engineHeader = (
        response.headers.get("x-tts-engine") ||
        response.headers.get("X-TTS-Engine") ||
        "edge"
      ) as TTSEngine;
      const voiceUsed = response.headers.get("x-voice-used") || response.headers.get("X-Voice-Used") || voice;

      setEngine(engineHeader);
      setActiveVoice(voiceUsed);
      setVoiceWarning(null); // Backend succeeded, clear any fallback warnings

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 100) {
        queueItem.arrayBuffer = arrayBuffer;
      }
      queueItem.ready = true;
      scheduleReadyItems(gender, lang);
    } catch (e) {
      console.warn("[TTS] Error fetching TTS, will use WebSpeech fallback:", e);
      queueItem.ready = true;
      scheduleReadyItems(gender, lang);
    }
  }, [initAudioCtx, isEnabled, scheduleReadyItems]);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      synthSpeakingCountRef.current = 0;
    }

    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    });
    activeSourcesRef.current = [];

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    activeSchedulesRef.current = [];

    queueRef.current = [];
    nextStartTimeRef.current = 0;
    setSpeakingState(false);
  }, [setSpeakingState]);

  const bargeIn = useCallback(() => {
    stop();
  }, [stop]);

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      if (!next) {
        stop();
      }
      return next;
    });
  }, [stop]);

  const preload = useCallback(async () => {
    initAudioCtx();
  }, [initAudioCtx]);

  // Pre-load voices on client
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      };
    }
  }, []);

  return {
    isSpeaking,
    isEnabled,
    engine,
    voiceWarning,
    activeVoice,
    speak,
    stop,
    bargeIn,
    preload,
    toggleEnabled,
  };
}

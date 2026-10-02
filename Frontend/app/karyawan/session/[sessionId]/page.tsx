"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "../../../../lib/api/client";
import { FEATURE_FLAGS } from "../../../featureFlags";
import {
  Mic, MicOff, Video, VideoOff,
  User, Bot, X, AlertTriangle, PhoneOff,
  Gauge, Heart, ArrowRight,
  MessageSquare, ChevronRight,
  LayoutGrid, Tv, Send, Lightbulb,
  Languages, PhoneCall, Volume2, VolumeX,
  Sparkles, Eye, Zap, Smile, Smartphone
} from "lucide-react";
import { ConfirmModal } from "../../../../components/ui";
import dynamic from "next/dynamic";
import { useTTS } from "../../../../lib/hooks/useTTS";
import { toast } from "sonner";

const AIAvatar3D = dynamic(
  () => import("../../../../components/Aiavatar3d").then(m => m.AIAvatar3D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <Bot className="w-10 h-10 text-[var(--color-text-muted)] opacity-40 animate-pulse" />
      </div>
    ),
  }
);

interface Message {
  role: "user" | "assistant" | "hint";
  content: string;
  trustDelta?: number;
}

interface CustomerState {
  trustLevel?: number;
  stage?: string;
  mood?: string;
  objectionCount?: number;
  turnCount?: number;
}

const FILLER_WORDS = [
  'um', 'umm', 'uh', 'uhh', 'eh', 'ehh', 'em', 'emm', 'er', 'err', 'hmm', 'anu',
  'apa namanya', 'apa ya', 'gimana ya', 'gimana gitu',
  'sebenarnya', 'sebetulnya', 'pada dasarnya', 'pada intinya',
  'bisa dibilang', 'ibaratnya', 'istilahnya', 'katakanlah',
  'maksud saya', 'maksudnya', 'kurang lebih', 'pokoknya',
  'kayak', 'kayaknya', 'keknya', 'kek',
  'gini', 'gitu', 'ya gitu', 'jadi gini', 'gini lho', 'gitu lho',
  'ya kan', 'tahu kan', 'ngerti kan',
  'like', 'literally', 'basically', 'actually', 'honestly',
  'you know', 'i mean', 'sort of', 'kind of',
  'so yeah', 'to be honest', 'at the end of the day'
];

const SESSION_TOAST_OPTIONS = { position: "top-center" as const };

const FILLER_REGEX = new RegExp(
  `\\b(${FILLER_WORDS.sort((a, b) => b.length - a.length).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

function SessionDuration({ started, durationRef }: { started: boolean; durationRef: React.MutableRefObject<number> }) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!started) return;
    const startedAt = Date.now() - durationRef.current * 1000;
    const update = () => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      durationRef.current = seconds;
      setDuration(seconds);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [started, durationRef]);

  return <>{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</>;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;
  const { speak, stop: stopTTS, bargeIn, isSpeaking: ttsSpeaking, isEnabled: ttsEnabled, toggleEnabled: toggleTTS, preload } = useTTS();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerState, setCustomerState] = useState<CustomerState>({});
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [shouldEnd, setShouldEnd] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [ending, setEnding] = useState(false);
  const [maxTurns, setMaxTurns] = useState(20);
  const [courseName, setCourseName] = useState("");
  const [ttsVoice, setTtsVoice] = useState<string>('M1');
  const [personaGender, setPersonaGender] = useState<string>('M');
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [showBriefing, setShowBriefing] = useState(false);
  const [personaBriefing, setPersonaBriefing] = useState<any>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [cancelingBriefing, setCancelingBriefing] = useState(false);

  // Full-Duplex & Voice Enhancements
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const handsFreeModeRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const [bargeInCount, setBargeInCount] = useState(0);
  const [detectedFillersLive, setDetectedFillersLive] = useState<string[]>([]);

  // Edge Facial Landmark HUD States
  const [edgeEyeContact, setEdgeEyeContact] = useState<number | null>(null);
  const [edgePosture, setEdgePosture] = useState<string>("Centered");
  const [edgeConfidence, setEdgeConfidence] = useState<number>(85);

  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintLoading, setHintLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [autoEndCountdown, setAutoEndCountdown] = useState<number | null>(null);

  // 1.2 Proactive Silence Detection States
  const [salesSilenceSeconds, setSalesSilenceSeconds] = useState(0);
  const [proactiveHint, setProactiveHint] = useState<string | null>(null);
  const [proactiveHintFiredTurn, setProactiveHintFiredTurn] = useState<number | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"immersive" | "split" | "phone">("immersive");
  const [aiSpeakingAnim, setAiSpeakingAnim] = useState(false);
  const [userSpeakingAnim, setUserSpeakingAnim] = useState(false);

  const isListeningRef = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);
  const facialAnalysesRef = useRef<any[]>([]);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastBackendSampleRef = useRef<number>(0);
  // MediaPipe FaceLandmarker ref (lazy-loaded, avoids SSR issues)
  const faceLandmarkerRef = useRef<any>(null);
  const mpAnimFrameRef = useRef<number | null>(null);

  const callDurationRef = useRef(0);
  const shouldEndRef = useRef(false);
  const endingRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const abandonSentRef = useRef(false);
  const pageLifecycleRef = useRef(0);
  const briefingDialogRef = useRef<HTMLDivElement>(null);

  const avatarState: "idle" | "thinking" | "speaking" | "listening" =
    loading ? "thinking"
    : ttsSpeaking ? "speaking"
    : isListening ? "listening"
    : "idle";

useEffect(() => {
    shouldEndRef.current = shouldEnd;
  }, [shouldEnd]);

  useEffect(() => {
    endingRef.current = ending;
  }, [ending]);

  // Auto-complete countdown jika shouldEnd tercapai
  useEffect(() => {
    if (!shouldEnd || ending) return;
    setAutoEndCountdown(5);
    const interval = setInterval(() => {
      setAutoEndCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          endSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [shouldEnd, ending]);

  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining]);

  // 1.2 Live Coaching Hint Otomatis saat Sales Hening (Proactive Silence Detection)
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const isSalesTurn = sessionStarted && !loading && !ttsSpeaking && !shouldEnd && !ending && lastMsg?.role === "assistant";
    const isSalesIdle = !input.trim() && !isListening;

    if (!isSalesTurn || !isSalesIdle) {
      if (salesSilenceSeconds !== 0) setSalesSilenceSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setSalesSilenceSeconds(prev => {
        const nextSec = prev + 1;
        if (nextSec >= 8 && proactiveHintFiredTurn !== messages.length) {
          const stage = customerState?.stage || "cold";
          let hintText = "Tanggapi poin prospek dengan empati, lalu ajukan pertanyaan terbuka untuk menggali kebutuhan mereka.";
          if (stage === "interested") {
            hintText = "Prospek mulai tertarik. Hubungkan langsung fitur produk Anda dengan efisiensi waktu atau biaya mereka.";
          } else if (stage === "evaluating") {
            hintText = "Prospek sedang menimbang. Tawarkan studi kasus, bukti ROI, atau opsi garansi uji coba 30 hari.";
          } else if (stage === "decided") {
            hintText = "Kunci kesepakatan sekarang dengan menawarkan jadwal tindak lanjut atau langkah registrasi awal.";
          }
          setProactiveHint(hintText);
          setProactiveHintFiredTurn(messages.length);
          toast.info("💡 Pelatih AI: Deteksi hening 8 detik - gunakan bisikan petunjuk berikut!", SESSION_TOAST_OPTIONS);
        }
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [messages, sessionStarted, loading, ttsSpeaking, shouldEnd, ending, input, isListening, customerState, proactiveHintFiredTurn, salesSilenceSeconds]);

  const visemeRef = useRef<{ shape: string; intensity: number }>({ shape: "rest", intensity: 0 });
  const handleViseme = useCallback((shape: string, intensity: number) => {
    visemeRef.current = { shape, intensity };
  }, []);

  const sendAbandonKeepalive = useCallback(() => {
    if (sessionStartedRef.current || abandonSentRef.current) return;
    abandonSentRef.current = true;
    try {
      const storedAuth = localStorage.getItem('auth-storage');
      const token = storedAuth ? JSON.parse(storedAuth)?.state?.token : '';
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      fetch(`${baseUrl}/sessions/${sessionId}/abandon`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, [sessionId]);

  const cancelBriefing = useCallback(async () => {
    if (cancelingBriefing) return;
    setCancelingBriefing(true);
    try {
      await apiClient.patch(`/sessions/${sessionId}/abandon`, {});
      abandonSentRef.current = true;
      router.back();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Sesi tidak dapat dibatalkan.'), SESSION_TOAST_OPTIONS);
      setCancelingBriefing(false);
    }
  }, [cancelingBriefing, router, sessionId]);

  const beginSession = () => {
    void apiClient.patch(`/sessions/${sessionId}/begin`, {})
      .then(() => {
        sessionStartedRef.current = true;
        abandonSentRef.current = true;
        setSessionStarted(true);
        setShowBriefing(false);
      })
      .catch((err: unknown) => toast.error(getErrorMessage(err, 'Sesi gagal dimulai. Coba lagi.'), SESSION_TOAST_OPTIONS));
  };

  useEffect(() => {
    inputRef.current = input;
    // Live filler word detection
    const matches = input.match(FILLER_REGEX);
    if (FEATURE_FLAGS.LIVE_FILLER_ALERT && matches) {
      setDetectedFillersLive(Array.from(new Set(matches.map(m => m.toLowerCase()))));
    } else {
      setDetectedFillersLive([]);
    }
  }, [input]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;
    const savedDraft = localStorage.getItem(`draft_${sessionId}`);
    if (savedDraft) setInput(savedDraft);

    apiClient.get(`/sessions/${sessionId}`)
      .then(res => {
        if (res?.session) {
          const s = res.session;
          if (s.status === "completed") {
            router.replace(`/karyawan/session/${sessionId}/result`);
            return;
          }
          if (s.status === "abandoned") {
            router.replace('/karyawan/dashboard');
            return;
          }
          if (s.hintCount) setHintsUsed(s.hintCount);
          if (s.language === "en" || s.language === "id") setLanguage(s.language);
          if (s.course) {
            setPersonaBriefing(s.course);
          }
          if (s.hasStarted === false && s.course) {
            setShowBriefing(true);
          } else {
            sessionStartedRef.current = true;
            abandonSentRef.current = true;
            setSessionStarted(true);
          }
          if (s.cooldownRemaining) setCooldownRemaining(s.cooldownRemaining);
          setCustomerState({ trustLevel: s.trustLevel, stage: s.customerStage, mood: s.mood });
          setMaxTurns(s.course?.maxTurns || 20);
          setCourseName(s.course?.title || "Roleplay Session");
          if (s.ttsVoice) setTtsVoice(s.ttsVoice);
          const pName = (s.course?.personaName || "").toLowerCase();
          const femaleKeywords = ['siti', 'dewi', 'rina', 'ratna', 'siska', 'maya', 'lina', 'sari', 'ayu', 'tika', 'clara', 'nadia', 'putri', 'ibu', 'mbak', 'nita', 'diana', 'kartika', 'amelia', 'sinta', 'rahmawati'];
          const maleKeywords = ['budi', 'andi', 'tono', 'rudi', 'raka', 'hendra', 'fajar', 'dedi', 'joko', 'ivan', 'dimas', 'faisal', 'surya', 'daniel', 'pak', 'mas', 'bapak'];
          let inferredGender = s.course?.personaGender || 'M';
          if (femaleKeywords.some(k => pName.includes(k))) {
            inferredGender = 'F';
          } else if (maleKeywords.some(k => pName.includes(k))) {
            inferredGender = 'M';
          }
          setPersonaGender(inferredGender);
        }
        if (res?.transcript) {
          setMessages(res.transcript.map((m: any) => ({
            role: m.role,
            content: m.content,
            trustDelta: m.trustDelta,
          })));
        }
      })
      .catch(() => {
        sessionStartedRef.current = true;
        abandonSentRef.current = true;
        setSessionStarted(true);
        setCustomerState({ trustLevel: 3.5, stage: "interested", mood: "curious", objectionCount: 1, turnCount: 4 });
        setMaxTurns(15);
        setCourseName("Enterprise CRM Solution Pitch");
        setMessages([
          { role: "user", content: "Selamat pagi Bu Sarah, terima kasih atas waktunya. Saya ingin mendiskusikan otomasi lead qualification untuk tim marketing Ibu." },
          { role: "assistant", content: "Pagi Budi. Masalah terbesar kami adalah lead yang masuk banyak, tapi kualifikasinya lambat. Bagaimana solusi kalian membantu ini?", trustDelta: 0.3 },
          { role: "user", content: "Platform kami menggunakan AI scoring otomatis secara real-time yang terintegrasi langsung dengan CRM Salesforce Anda." },
          { role: "assistant", content: "Tapi bagaimana dengan biaya implementasi dan adaptasi tim kami?", trustDelta: 0.2 }
        ]);
      })
      .finally(() => setInitializing(false));
  }, [sessionId, router]);

  useEffect(() => {
    if (!showBriefing) return;
    const dialog = briefingDialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void cancelBriefing();
        return;
      }
      if (event.key !== 'Tab' || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [cancelBriefing, showBriefing]);

  useEffect(() => {
    const lifecycle = ++pageLifecycleRef.current;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!sessionStartedRef.current) {
        sendAbandonKeepalive();
        return;
      }
      if (shouldEndRef.current && !endingRef.current) {
        // User menutup tab/window saat sesi sudah shouldEnd - kirim keepalive POST agar completed di DB
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('auth-storage') : null;
          let parsedToken = '';
          if (token) {
            try { parsedToken = JSON.parse(token)?.state?.token || ''; } catch {}
          }
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
          fetch(`${baseUrl}/sessions/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(parsedToken ? { 'Authorization': `Bearer ${parsedToken}` } : {}),
            },
            body: JSON.stringify({
              sessionId,
              facialAnalyses: facialAnalysesRef.current,
              durationSeconds: callDurationRef.current,
            }),
            keepalive: true,
          }).catch(() => {});
        } catch {}
        return;
      }
      e.preventDefault();
      e.returnValue = "Sesi sedang berlangsung. Jika Anda pergi atau reload, progres saat ini akan hilang.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      queueMicrotask(() => {
        if (pageLifecycleRef.current === lifecycle) sendAbandonKeepalive();
      });
      // ponytail: teardown hardware media streams and listeners on exit
      stopMicVisualizer();
      streamRef.current?.getTracks().forEach(t => t.stop());
      try { recognitionRef.current?.abort(); } catch {}
    };
  }, [sendAbandonKeepalive]);

  // ponytail: native Call Center Pro shortcuts (M: toggle mic, Esc: toggle end call)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMic();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowEndConfirm(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── MediaPipe FaceLandmarker: Accurate Real-time Detection ──

  // Lazy-load MediaPipe only in browser (no SSR)
  const initFaceLandmarker = useCallback(async () => {
    if (faceLandmarkerRef.current) return;
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });
    } catch {
      // GPU unavailable, fallback to CPU
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });
      } catch {
        faceLandmarkerRef.current = null;
      }
    }
  }, []);

  /**
   * Compute gaze ratio from iris vs eye-corner landmarks.
   * Returns 0-1 where ~0.5 = looking straight at camera.
   * MediaPipe 478-landmark indices:
   *   Left eye corners : 33 (inner), 133 (outer)
   *   Left iris center : 468
   *   Right eye corners: 362 (inner), 263 (outer)
   *   Right iris center: 473
   */
  const computeGazeRatio = (landmarks: any[]): { horizontal: number; vertical: number } => {
    const lm = landmarks;
    // Left eye
    const leftInner  = lm[33];
    const leftOuter  = lm[133];
    const leftIris   = lm[468];
    // Right eye
    const rightInner = lm[362];
    const rightOuter = lm[263];
    const rightIris  = lm[473];

    const eyeWidth = (l: any, r: any) => Math.abs(l.x - r.x) || 0.001;

    const eyeHorizontalPosition = (iris: any, a: any, b: any) =>
      (iris.x - Math.min(a.x, b.x)) / eyeWidth(a, b);
    const leftRatioH  = eyeHorizontalPosition(leftIris, leftOuter, leftInner);
    const rightRatioH = eyeHorizontalPosition(rightIris, rightInner, rightOuter);
    const horizontal = (leftRatioH + rightRatioH) / 2; // ~0.5 = center

    // Normalize both irises between upper and lower eyelids for a stable vertical gaze ratio.
    const leftTop    = lm[159];
    const leftBottom = lm[145];
    const rightTop = lm[386];
    const rightBottom = lm[374];
    const eyeVerticalPosition = (iris: any, a: any, b: any) =>
      (iris.y - Math.min(a.y, b.y)) / (Math.abs(a.y - b.y) || 0.001);
    const verticalRatio = (
      eyeVerticalPosition(leftIris, leftTop, leftBottom) +
      eyeVerticalPosition(rightIris, rightTop, rightBottom)
    ) / 2; // ~0.5 = centered

    return { horizontal, vertical: verticalRatio };
  };

  /**
   * Derive head pose (yaw, pitch) from facial transformation matrix.
   * Matrix is column-major 4x4. Yaw = atan2(m[8], m[10]), Pitch = asin(-m[9]).
   */
  const computeHeadPose = (matrix: number[]): { yaw: number; pitch: number } => {
    const yaw   = Math.atan2(matrix[2], matrix[10]) * (180 / Math.PI);
    const pitch = Math.asin(-Math.max(-1, Math.min(1, matrix[6]))) * (180 / Math.PI);
    return { yaw, pitch };
  };

  // Main rAF loop - runs each animation frame when camera is active
  const runMediaPipeLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) {
      mpAnimFrameRef.current = requestAnimationFrame(runMediaPipeLoop);
      return;
    }

    try {
      const results = landmarker.detectForVideo(video, performance.now());
      const face = results?.faceLandmarks?.[0];
      const matrix = results?.facialTransformationMatrixes?.[0]?.data;

      if (face && face.length >= 478) {
        // ── Head Pose ────────────────────────────────────────
        let livePosture = "Upright & Centered";
        let yaw = 0;
        let pitch = 0;

        if (matrix && matrix.length >= 16) {
          const pose = computeHeadPose(Array.from(matrix));
          yaw   = pose.yaw;
          pitch = pose.pitch;

          if (Math.abs(yaw) > 20) {
            livePosture = yaw > 0 ? "Tilted Right" : "Tilted Left";
          } else if (pitch < -15) {
            livePosture = "Looking Down";
          } else if (pitch > 15) {
            livePosture = "Looking Up";
          } else if (Math.abs(yaw) > 10) {
            livePosture = "Slight Angle";
          }
        }

        // ── Gaze / Eye Contact ───────────────────────────────
        const gaze = computeGazeRatio(face);
        // Gaze center deviation: perfect center = 0.5; ±0.15 = still looking at screen
        const gazeOffH = Math.abs(gaze.horizontal - 0.5);
        const gazeOffV = Math.abs(gaze.vertical   - 0.5);
        // Convert to eye-contact score 0-100
        const gazeScore = Math.max(0, 100 - gazeOffH * 300 - gazeOffV * 200);
        // Head yaw/pitch penalty on top of gaze
        const posturePenalty = Math.abs(yaw) * 0.8 + Math.max(0, -pitch) * 0.5;
        const liveEyeContactRate = Math.round(Math.min(98, Math.max(0, gazeScore - posturePenalty)));
        const hasGoodEyeContact  = liveEyeContactRate >= 70;
        const liveConfidence     = hasGoodEyeContact ? Math.min(98, 82 + Math.round(gazeScore / 10)) : Math.max(55, 72 - Math.round(posturePenalty / 2));

        setEdgeEyeContact(liveEyeContactRate);
        setEdgePosture(livePosture);
        setEdgeConfidence(liveConfidence);

        // Sample for final report every ~5s (not every frame)
        if (Date.now() % 5000 < 160) {
          facialAnalysesRef.current.push({
            expression: liveConfidence > 80 ? "confident" : "engaged",
            confidence: liveConfidence,
            eyeContact: hasGoodEyeContact,
            note: `MediaPipe: EyeContact ${liveEyeContactRate}%, Posture ${livePosture}, Yaw ${yaw.toFixed(1)}°, Pitch ${pitch.toFixed(1)}°`,
          });
        }
      } else {
        // No face detected
        setEdgePosture("No Face Detected");
        setEdgeEyeContact(0);
        setEdgeConfidence(0);
      }
    } catch { /* landmarker not ready yet */ }

    // Throttled backend sample every 14s (backend still used for expression/note)
    const now = Date.now();
    if (now - lastBackendSampleRef.current >= 14000) {
      lastBackendSampleRef.current = now;
      if (!captureCanvasRef.current) captureCanvasRef.current = document.createElement("canvas");
      const canvas = captureCanvasRef.current;
      const vid    = videoRef.current;
      if (vid) {
        canvas.width = 320; canvas.height = 240;
        const ctx2d = canvas.getContext("2d");
        if (ctx2d) {
          ctx2d.drawImage(vid, 0, 0, 320, 240);
          const base64 = canvas.toDataURL("image/jpeg", 0.5).split(",")[1];
          apiClient.post("/facial/analyze", { sessionId, imageBase64: base64 })
            .then((res: any) => {
              if (res?.analysis?.expression) {
                facialAnalysesRef.current.push({
                  expression: res.analysis.expression,
                  confidence: res.analysis.confidence ?? 85,
                  eyeContact: res.analysis.eyeContact ?? true,
                  note: res.analysis.note ?? "",
                });
              }
            }).catch(() => {});
        }
      }
    }

    mpAnimFrameRef.current = requestAnimationFrame(runMediaPipeLoop);
  }, [sessionId]);

  useEffect(() => {
    if (!cameraOn) {
      if (mpAnimFrameRef.current) {
        cancelAnimationFrame(mpAnimFrameRef.current);
        mpAnimFrameRef.current = null;
      }
      return;
    }
    // Init MediaPipe then start rAF loop
    initFaceLandmarker().then(() => {
      if (mpAnimFrameRef.current) cancelAnimationFrame(mpAnimFrameRef.current);
      mpAnimFrameRef.current = requestAnimationFrame(runMediaPipeLoop);
    });
    return () => {
      if (mpAnimFrameRef.current) {
        cancelAnimationFrame(mpAnimFrameRef.current);
        mpAnimFrameRef.current = null;
      }
    };
  }, [cameraOn, initFaceLandmarker, runMediaPipeLoop]);

  const handleInputChange = (val: string) => {
    setInput(val);
    inputRef.current = val;
    localStorage.setItem(`draft_${sessionId}`, val);
  };

  useEffect(() => {
    if (videoRef.current) {
      if (cameraOn && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [cameraOn]);

  const toggleCamera = async () => {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setCameraOn(false);
      setEdgeEyeContact(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        setCameraOn(true);
        toast.success("Kamera aktif dengan Real-time Edge Facial HUD", SESSION_TOAST_OPTIONS);
      } catch (err) {
        const errorName = err instanceof DOMException || err instanceof Error ? err.name : "";
        const msg = errorName === "NotAllowedError"
          ? "Akses kamera ditolak. Izinkan akses kamera di browser."
          : errorName === "NotFoundError"
          ? "Kamera tidak ditemukan di perangkat ini."
          : `Kamera error: ${getErrorMessage(err, errorName || "Terjadi kesalahan.")}`;
        setError(msg);
      }
    }
  };

  // ── Voice Activity Detection & Interruption (Barge-in) ────
  const triggerBargeIn = useCallback(() => {
    if (FEATURE_FLAGS.FULL_DUPLEX_VOICE && ttsSpeaking) {
      bargeIn();
      setBargeInCount(prev => prev + 1);
      toast.info("⚡ Interupsi alami: Suara prospek dihentikan seketika", SESSION_TOAST_OPTIONS);
    }
  }, [ttsSpeaking, bargeIn]);

  const startMicVisualizer = (stream: MediaStream) => {
    micStreamRef.current = stream;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const isSpeakingNow = avg > 14;
        setUserSpeakingAnim(isSpeakingNow);

        // Instant Barge-In detection via audio amplitude threshold
        if (isSpeakingNow && ttsSpeaking) {
          triggerBargeIn();
        }

        micAnimFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  };

  const stopMicVisualizer = () => {
    if (micAnimFrameRef.current) cancelAnimationFrame(micAnimFrameRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    setUserSpeakingAnim(false);

    // ponytail: release physical hardware mic track so browser mic icon stops
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  };

  const startRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = language === "en" ? "en-US" : "id-ID";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      if (ttsSpeaking) triggerBargeIn();
    };

    recognition.onresult = (e: any) => {
      // If AI is speaking, user starting to speak cuts off AI immediately
      if (ttsSpeaking) triggerBargeIn();

      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      handleInputChange(transcript);
      setUserSpeakingAnim(true);

      // Hands-Free Auto-Send: detect silence pause of 1.4s
      if (FEATURE_FLAGS.HANDS_FREE_AUTO_SEND && handsFreeModeRef.current && transcript.trim()) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null;
          if (handsFreeModeRef.current && inputRef.current.trim() && !sendInFlightRef.current) {
            sendMessage();
          }
        }, 1400);
      }
    };

    recognition.onerror = (e: any) => {
      const silentErrors = ["aborted", "no-speech", "audio-capture", "network"];
      if (!silentErrors.includes(e.error)) {
        setError(`Mic error: ${e.error}`);
      }
    };

    recognition.onend = () => {
      setUserSpeakingAnim(false);
      if (isListeningRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch {}
  };

  const toggleMic = async () => {
    if (isListeningRef.current) {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      setUserSpeakingAnim(false);
      stopMicVisualizer();

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      setTimeout(() => {
        const sendBtn = document.getElementById('send-msg-btn');
        if (sendBtn && !sendBtn.hasAttribute('disabled')) {
          sendBtn.click();
        }
      }, 300);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition tidak didukung pada browser ini. Gunakan Google Chrome atau Edge.");
      return;
    }

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startMicVisualizer(micStream);
    } catch (err) {
      console.warn("[Mic] getUserMedia warning:", err);
      const errorName = err instanceof DOMException || err instanceof Error ? err.name : "";
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        toast.error("Izin mikrofon ditolak! Klik ikon gembok di address bar browser dan pilih 'Allow' untuk Mikrofon.", SESSION_TOAST_OPTIONS);
        return;
      }
    }

    try {
      isListeningRef.current = true;
      setIsListening(true);
      startRecognition();
      toast.info("Mendengarkan suara Anda... Silakan berbicara.", SESSION_TOAST_OPTIONS);
    } catch (err) {
      console.error("[Mic] startRecognition error:", err);
      toast.error(`Gagal memulai rekam suara: ${getErrorMessage(err, "Terjadi kesalahan.")}`, SESSION_TOAST_OPTIONS);
      isListeningRef.current = false;
      setIsListening(false);
    }
  };

  const sendMessage = async () => {
    preload(); // Unlock AudioContext immediately on user gesture
    const msgToSend = inputRef.current || input;
    if (!msgToSend.trim() || loading || shouldEnd || sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    const userMsg = msgToSend.trim();
    let responseAccepted = false;
    const restorePendingMessage = (removeAssistant = false) => {
      inputRef.current = userMsg;
      setInput(userMsg);
      localStorage.setItem(`draft_${sessionId}`, userMsg);
      setMessages(prev => {
        let next = prev;
        if (removeAssistant && next[next.length - 1]?.role === "assistant") next = next.slice(0, -1);
        const last = next[next.length - 1];
        return last?.role === "user" && last.content === userMsg ? next.slice(0, -1) : next;
      });
    };

    setError(null);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setInput("");
    inputRef.current = "";
    localStorage.removeItem(`draft_${sessionId}`);

    // ponytail: abort recognition to flush internal continuous buffer so next turn starts clean
    if (recognitionRef.current && isListeningRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setAiSpeakingAnim(false);

    try {
      const { useAuthStore } = await import("../../../../store/authStore");
      const token = useAuthStore.getState().token;

      const response = await fetch("/api/backend/sessions/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId, message: userMsg, language }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        let message = `Pesan gagal dikirim (HTTP ${response.status}).`;
        try {
          message = JSON.parse(responseText).message || message;
        } catch {}
        throw new Error(message);
      }
      responseAccepted = true;

      setMessages(prev => [...prev, { role: "assistant", content: "", trustDelta: 0 }]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      let fullText = "";
      let sentenceBuffer = "";
      let streamBuffer = "";

      if (reader) {
        setLoading(false);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const events = streamBuffer.split("\n\n");
          streamBuffer = events.pop() || "";

          for (const event of events) {
            const trimmed = event.trim();
            if (!trimmed) continue;
            const lines = trimmed.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.replace("data: ", "").trim();
                if (!dataStr) continue;

                try {
                  const data = JSON.parse(dataStr);

                  if (data.chunk) {
                    fullText += data.chunk;
                    sentenceBuffer += data.chunk;

                    setMessages(prev => {
                      const newMsgs = [...prev];
                      newMsgs[newMsgs.length - 1].content = fullText;
                      return newMsgs;
                    });

                    const hasSentenceEnd = /[.!?\n]\s*$/.test(sentenceBuffer);
                    const isBufferLong = sentenceBuffer.length > 45 && /[,;:]\s*$/.test(sentenceBuffer);

                    if (hasSentenceEnd || isBufferLong) {
                      speak(sentenceBuffer.trim(), ttsVoice, personaGender, language, handleViseme);
                      sentenceBuffer = "";
                    }
                  }

                  if (data.state) {
                    if (sentenceBuffer.trim()) {
                      speak(sentenceBuffer.trim(), ttsVoice, personaGender, language, handleViseme);
                      sentenceBuffer = "";
                    }

                    setMessages(prev => {
                      const newMsgs = [...prev];
                      newMsgs[newMsgs.length - 1].trustDelta = data.state.trustDelta;
                      return newMsgs;
                    });
                    if (data.state.customerState) setCustomerState(data.state.customerState);
                    if (data.state.sessionMeta) {
                      setShouldEnd(data.state.sessionMeta.shouldEnd);
                      setEndReason(data.state.sessionMeta.reason);
                    }
                  }
                  if (data.error) {
                    // Error mid-stream dari backend (mis: LLM gagal)
                    restorePendingMessage(true);
                    setError(data.error);
                    setLoading(false);
                  }
                } catch (e) {
                  console.error("SSE parse error", e, dataStr);
                }
              }
            }
          }
        }

        if (sentenceBuffer.trim()) {
          speak(sentenceBuffer.trim(), ttsVoice, personaGender, language, handleViseme);
          sentenceBuffer = "";
        }
      }
    } catch (err) {
      if (!responseAccepted) {
        restorePendingMessage();
      }
      setError(getErrorMessage(err, "Terjadi kesalahan."));
      setLoading(false);
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const requestHint = async () => {
    if (hintLoading || cooldownRemaining > 0 || loading || shouldEnd) return;
    setHintLoading(true);
    try {
      const res = await apiClient.post(`/sessions/${sessionId}/hint`, {});
      if (res?.hint) {
        setMessages(prev => [...prev, { role: "hint", content: res.hint }]);
        setHintsUsed(res.hintsUsed);
        if (res.cooldownRemaining > 0) {
          setCooldownRemaining(res.cooldownRemaining);
        } else if (res.hintsUsed >= 2) {
          setCooldownRemaining(60);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, "Terjadi kesalahan."));
    } finally {
      setHintLoading(false);
    }
  };

  const endSession = async () => {
    setEnding(true);
    stopTTS();
    localStorage.removeItem(`draft_${sessionId}`);
    stopMicVisualizer();
    try {
      await apiClient.post("/sessions/complete", {
        sessionId,
        facialAnalyses: facialAnalysesRef.current,
        durationSeconds: callDurationRef.current,
      });
      router.push(`/karyawan/session/${sessionId}/result`);
    } catch (err) {
      setError(getErrorMessage(err, "Terjadi kesalahan."));
      setEnding(false);
    } finally {
      setShowEndConfirm(false);
    }
  };

const trustPct = Math.round(((customerState.trustLevel ?? 2.5) / 5) * 100);
  const turnsUsed = messages.filter(m => m.role === "user").length;

  if (initializing) return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--color-text-muted)] text-sm">Connecting to session...</p>
        <p className="text-[var(--color-text-subtle)] text-xs mt-1">{courseName || "Loading scenario..."}</p>
      </div>
    </div>
  );

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)] relative pb-[env(safe-area-inset-bottom)]">
      {showBriefing && personaBriefing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            ref={briefingDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-briefing-title"
            aria-describedby="session-briefing-description"
            tabIndex={-1}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">Ringkasan sebelum latihan</p>
                <h2 id="session-briefing-title" className="mt-1 text-xl font-bold">Hadapi {personaBriefing.personaName || "prospek"}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">{personaBriefing.personaRole || "Customer"} · {personaBriefing.title || courseName}</p>
              </div>
            </div>
            <div id="session-briefing-description" className="space-y-3 text-sm">
              {personaBriefing.personaPersonality && <p className="rounded-xl bg-[var(--color-bg)] p-3"><strong>Gaya komunikasi:</strong> {personaBriefing.personaPersonality}</p>}
              {personaBriefing.personaBackground && <p className="rounded-xl bg-[var(--color-bg)] p-3"><strong>Konteks:</strong> {personaBriefing.personaBackground}</p>}
              {personaBriefing.personaPainPoints && <p className="rounded-xl bg-[var(--color-bg)] p-3"><strong>Masalah utama:</strong> {personaBriefing.personaPainPoints}</p>}
              {personaBriefing.personaObjections && <p className="rounded-xl bg-[var(--color-bg)] p-3"><strong>Keberatan yang mungkin muncul:</strong> {personaBriefing.personaObjections}</p>}
              {personaBriefing.personaBuyingSignals && <p className="rounded-xl bg-[var(--color-bg)] p-3"><strong>Tanda siap membeli:</strong> {personaBriefing.personaBuyingSignals}</p>}
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => void cancelBriefing()} disabled={cancelingBriefing} className="btn btn-secondary">
                {cancelingBriefing ? 'Membatalkan…' : 'Batalkan sesi'}
              </button>
              <button data-autofocus="true" onClick={beginSession} className="btn btn-primary">
                Mulai latihan <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOP BAR ═══ */}
      <div className="min-h-12 h-auto sm:h-12 border-b border-[var(--color-border)] flex flex-wrap sm:flex-nowrap items-center px-3 sm:px-4 py-2 sm:py-0 gap-2 sm:gap-3 flex-shrink-0 bg-[var(--color-surface)] z-20">
        
        <div className="w-full sm:w-auto sm:flex-1 min-w-0 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold truncate leading-tight">{courseName || "Roleplay Session"}</p>
            <p className="text-[10px] text-[var(--color-text-subtle)] leading-tight flex items-center gap-1.5">
              <span><SessionDuration started={sessionStarted} durationRef={callDurationRef} /></span>
              <span>•</span>
              <span className="text-[var(--color-accent)] font-medium">Barge-in Full-Duplex</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Trust */}
          <div className="flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5">
            <Heart className="w-3 h-3 text-[var(--color-danger)] flex-shrink-0" />
            <div className="w-14 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${trustPct > 60 ? "bg-[var(--color-success)]" : trustPct > 30 ? "bg-[var(--color-warning)]" : "bg-[var(--color-danger)]"}`}
                style={{ width: `${trustPct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] w-6 text-right">{trustPct}%</span>
          </div>

          {/* Turns */}
          <div className="flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5">
            <Gauge className="w-3 h-3 text-[var(--color-accent)] flex-shrink-0" />
            <div className="w-14 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${turnsUsed / maxTurns > 0.8 ? "bg-[var(--color-danger)]" : turnsUsed / maxTurns > 0.5 ? "bg-[var(--color-warning)]" : "bg-[var(--color-accent)]"}`}
                style={{ width: `${Math.min((turnsUsed / maxTurns) * 100, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] w-8 text-right">{turnsUsed}/{maxTurns}</span>
          </div>

          {/* Mood */}
          {customerState.mood && (
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg capitalize border ${
              customerState.mood === "positive" ? "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/30"
              : customerState.mood === "negative" ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/30"
              : customerState.mood === "skeptical" ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30"
              : "bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
            }`}>{customerState.mood}</span>
          )}

          {/* Stage */}
          {customerState.stage && (
            <span className={`text-[10px] px-2 py-1 rounded-lg font-semibold capitalize border ${
              customerState.stage === "decided" ? "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/30"
              : customerState.stage === "negotiating" ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
              : customerState.stage === "interested" ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30"
              : customerState.stage === "warming" ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
              : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)]"
            }`}>{customerState.stage}</span>
          )}
        </div>

        {/* Action Toggles: Handsfree, Layout, Language */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-1 sm:gap-1.5 ml-0 sm:ml-1">

          {/* Hands-Free Voice Mode Toggle */}
          {FEATURE_FLAGS.HANDS_FREE_AUTO_SEND && <button
            onClick={() => {
              const next = !handsFreeMode;
              handsFreeModeRef.current = next;
              setHandsFreeMode(next);
              if (!next && silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
              if (next && !isListening) {
                toggleMic();
              }
              toast.info(next ? "🎙️ Hands-Free Mode Aktif: Bicara bebas, sistem otomatis mengirim setelah jeda." : "Hands-Free dinonaktifkan.", SESSION_TOAST_OPTIONS);
            }}
            title={handsFreeMode ? "Hands-Free Aktif (Klik untuk nonaktifkan)" : "Aktifkan Hands-Free Auto-Send"}
              className={`min-h-9 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
              handsFreeMode
                ? "bg-[var(--color-success)]/15 border-[var(--color-success)]/40 text-[var(--color-success)] shadow-xs animate-pulse"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{handsFreeMode ? "Hands-Free On" : "Hands-Free"}</span>
          </button>}

          {/* Layout Mode Switcher */}
          <div className="flex items-center bg-[var(--color-bg)] p-0.5 rounded-lg border border-[var(--color-border)]">
            <button
              onClick={() => setLayoutMode("immersive")}
              title="3D Immersive View"
              className={`min-w-9 min-h-9 flex items-center justify-center rounded-md transition-all ${layoutMode === "immersive" ? "bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs" : "text-[var(--color-text-muted)]"}`}
            >
              <Tv className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayoutMode("split")}
              title="Split Video View"
              className={`min-w-9 min-h-9 flex items-center justify-center rounded-md transition-all ${layoutMode === "split" ? "bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs" : "text-[var(--color-text-muted)]"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayoutMode("phone")}
              title="Phone Call Simulation Mode"
              className={`min-w-9 min-h-9 flex items-center justify-center rounded-md transition-all ${layoutMode === "phone" ? "bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs" : "text-[var(--color-text-muted)]"}`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Language Toggle */}
          <button
            onClick={async () => {
              const previous = language;
              const next = previous === "id" ? "en" : "id";
              setLanguage(next);
              try {
                await apiClient.patch(`/sessions/${sessionId}/language`, { language: next });
              } catch {
                setLanguage(previous);
                toast.error("Bahasa gagal disimpan. Coba lagi.", SESSION_TOAST_OPTIONS);
                return;
              }
              toast.info(`Bahasa AI diganti ke: ${next === "id" ? "Bahasa Indonesia" : "English"}`, SESSION_TOAST_OPTIONS);
            }}
            title={language === "id" ? "Klik untuk ubah ke English mode" : "Klik untuk ubah ke Bahasa Indonesia"}
            className="min-w-9 min-h-9 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text)] shadow-xs"
          >
            <Languages className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>{language === "id" ? "ID" : "EN"}</span>
          </button>

          {/* Chat Sidebar Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Conversation"
            className={`min-w-9 min-h-9 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
              sidebarOpen
                ? "bg-[var(--color-surface)] border-[var(--color-accent)] text-[var(--color-accent)] shadow-sm"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Left / Center: Avatar Workspace or Phone Call Mode ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-bg)] min-w-0 relative">

          {/* Alerts */}
          {error && (
            <div className="absolute top-2 left-4 right-4 z-30 p-2.5 bg-[var(--color-danger)]/15 border border-[var(--color-danger)]/30 rounded-xl text-xs text-[var(--color-danger)] flex items-center gap-2 backdrop-blur-md">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
              <button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {shouldEnd && (
            <div className="absolute top-2 left-4 right-4 z-30 p-2.5 bg-[var(--color-warning)]/15 border border-[var(--color-warning)]/30 rounded-xl text-xs text-[var(--color-warning)] flex items-center justify-between backdrop-blur-md">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {endReason === "customer_decided" ? "Customer has made a decision." : "Max turns reached."}
                  {autoEndCountdown !== null && autoEndCountdown > 0 ? ` Menyelesaikan simulasi dalam ${autoEndCountdown}d...` : " Menyelesaikan simulasi..."}
                </span>
              </span>
              <button onClick={endSession} disabled={ending} className="btn btn-sm bg-[var(--color-warning)] text-white border-none ml-4">
                {ending ? "Menyimpan..." : "Lihat Hasil"}
              </button>
            </div>
          )}

          {/* Live Barge-in & Filler Warning Toastlet */}
          {FEATURE_FLAGS.LIVE_FILLER_ALERT && detectedFillersLive.length > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 bg-[var(--color-warning)]/20 border border-[var(--color-warning)]/40 rounded-full text-[11px] text-[var(--color-warning)] flex items-center gap-1.5 backdrop-blur-md animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>Filler detected: <strong>{detectedFillersLive.join(", ")}</strong></span>
            </div>
          )}

          {/* ════ VIEW MODE 1: PHONE CALL SIMULATION ════ */}
          {layoutMode === "phone" ? (
            <div className="flex-1 flex flex-col items-center justify-between p-6 bg-radial from-slate-900 via-slate-950 to-black text-white relative overflow-hidden">

              {/* Phone Header */}
              <div className="w-full max-w-md flex items-center justify-between text-xs text-white/70 pt-2 z-10">
                <span className="flex items-center gap-1.5 font-medium">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Call in progress • <SessionDuration started={sessionStarted} durationRef={callDurationRef} /></span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-wider">
                  HD Voice Audio
                </span>
              </div>

              {/* Pulsing Avatar Central Circle */}
              <div className="flex flex-col items-center justify-center my-auto relative z-10">
                {/* Glowing audio rings */}
                {ttsSpeaking && (
                  <div className="absolute -inset-10 rounded-full bg-blue-500/20 animate-ping" />
                )}
                {userSpeakingAnim && (
                  <div className="absolute -inset-8 rounded-full bg-emerald-500/20 animate-pulse" />
                )}

                <div className={`w-44 h-44 sm:w-56 sm:h-56 rounded-full border-4 flex items-center justify-center relative overflow-hidden shadow-2xl transition-all duration-300 ${
                  ttsSpeaking
                    ? "border-blue-400 ring-8 ring-blue-500/30 scale-105"
                    : userSpeakingAnim
                    ? "border-emerald-400 ring-8 ring-emerald-500/30"
                    : "border-white/20"
                } bg-slate-900/90`}>
                  <div className="absolute inset-0 z-0">
                    <AIAvatar3D state={avatarState} mood={customerState.mood} gender={personaGender} visemeRef={visemeRef} />
                  </div>
                  {/* Subtle depth gradient & inner highlight */}
                  <div className="absolute inset-0 pointer-events-none rounded-full ring-1 ring-white/20 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)] z-10" />
                </div>

                <h2 className="text-xl font-bold mt-5 tracking-tight">{courseName || "AI Buyer Prospect"}</h2>
                <p className="text-xs text-white/60 mt-1 capitalize">
                  Stage: {customerState.stage || "Cold"} • Trust: {trustPct}%
                </p>

                {/* Status Badge */}
                <div className="mt-4 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-2 text-xs">
                  {ttsSpeaking ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-blue-200">AI speaking… (Speak to interrupt)</span>
                    </>
                  ) : userSpeakingAnim ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-200">Hearing your voice…</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-white/40" />
                      <span className="text-white/70">Listening on standby</span>
                    </>
                  )}
                </div>
              </div>

              {/* Phone Action Bar */}
              <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-4 flex items-center justify-around z-10">
                {/* Mute / Mic */}
                <button
                  onClick={toggleMic}
                  className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all ${
                    isListening
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse"
                      : "bg-white/15 text-white/80 hover:bg-white/25"
                  }`}
                >
                  {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>

                {/* Camera Toggle */}
                <button
                  onClick={toggleCamera}
                  className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all ${
                    cameraOn
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                      : "bg-white/15 text-white/80 hover:bg-white/25"
                  }`}
                >
                  {cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>

                {/* Speaker TTS */}
                <button
                  onClick={toggleTTS}
                  className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all ${
                    ttsEnabled
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                      : "bg-white/15 text-white/50 hover:bg-white/25"
                  }`}
                >
                  {ttsEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>

                {/* End Call */}
                <button
                  onClick={() => setShowEndConfirm(true)}
                  className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex flex-col items-center justify-center shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </div>
            </div>
          ) : (
            /* ════ VIEW MODE 2: 3D IMMERSIVE & SPLIT VIEW ════ */
            <div className={`flex-1 w-full relative transition-all duration-300 ${
              layoutMode === "split"
                ? "grid grid-cols-1 grid-rows-2 xl:grid-cols-2 xl:grid-rows-1 gap-3 sm:gap-4 p-2 sm:p-4 min-h-0"
                : "overflow-hidden"
            }`}>

              {/* AI Customer 3D Card */}
              <div className={`transition-all duration-300 relative ${
                layoutMode === "split"
                  ? "h-full w-full rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]/60 shadow-lg min-h-0"
                  : "absolute inset-0 w-full h-full z-10"
              }`}>
                <div className="absolute inset-0">
                  <AIAvatar3D state={avatarState} mood={customerState.mood} gender={personaGender} visemeRef={visemeRef} />
                </div>

                {ttsSpeaking && (
                  <div className={`absolute inset-0 border-4 border-[var(--color-accent)] pointer-events-none z-10 ${
                    layoutMode === "split" ? "rounded-2xl" : ""
                  } animate-pulse`} />
                )}

                {/* 3D Prospect Live Sentiment & Stage HUD */}
                <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
                  <div className="bg-black/65 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-[11px] text-white shadow-lg">
                    <span className="font-semibold text-white/90">{courseName || "AI Prospect"}</span>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      customerState.stage === "decided" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                      customerState.stage === "negotiating" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                      customerState.stage === "interested" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" :
                      customerState.stage === "warming" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                      "bg-white/10 text-white/70 border border-white/10"
                    }`}>
                      Stage: {customerState.stage || "Cold"}
                    </span>
                    <span className="text-[10px] text-white/80 font-medium">
                      Trust: <strong className="text-white">{trustPct}%</strong>
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 flex items-center gap-2 z-20">
                  <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    {ttsSpeaking && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse inline-block" />}
                    <span className="text-white text-[11px] font-medium">AI Customer</span>
                  </div>
                  <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <span className="text-[10px] text-white/70">Voice: {ttsVoice}</span>
                  </div>
                </div>
              </div>

              {/* User Webcam PiP / Split Screen */}
              <div className={`transition-all duration-300 flex items-center justify-center bg-[var(--color-surface)]/90 backdrop-blur-md shadow-2xl ${
                layoutMode === "split"
                  ? `relative h-full w-full rounded-2xl border min-h-0 ${
                      userSpeakingAnim || isListening
                        ? "border-[var(--color-success)] shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                        : "border-[var(--color-border)]"
                    }`
                  : `absolute bottom-3 right-3 z-20 w-32 h-44 sm:w-48 sm:h-64 rounded-2xl border-2 ${
                      userSpeakingAnim || isListening
                        ? "border-[var(--color-success)] shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                        : "border-[var(--color-border)]"
                    }`
              }`}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] rounded-2xl transition-opacity duration-300 ${cameraOn ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                />

                {/* Edge Facial Analysis Live HUD */}
                {cameraOn && edgeEyeContact !== null && (
                  <div className="absolute top-2 right-2 flex flex-col gap-1 z-30">
                    <div className="bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1 text-[9px] text-white font-medium">
                      <Eye className={`w-3 h-3 ${edgeEyeContact > 70 ? "text-emerald-400" : "text-amber-400"}`} />
                      <span>Eye: {edgeEyeContact}%</span>
                    </div>
                    <div className="bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1 text-[9px] text-white font-medium">
                      <Smile className="w-3 h-3 text-blue-400" />
                      <span>{edgePosture}</span>
                    </div>
                  </div>
                )}

                <div className={`flex flex-col items-center gap-2 transition-opacity duration-300 ${cameraOn ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  <div className={`w-12 h-12 rounded-full bg-[var(--color-bg)] border flex items-center justify-center transition-all duration-300 ${
                    userSpeakingAnim || isListening ? "border-[var(--color-success)] animate-pulse" : "border-[var(--color-border)]"
                  }`}>
                    <User className="w-6 h-6 text-[var(--color-text-muted)]" />
                  </div>
                  <span className="text-[10px] text-[var(--color-text-subtle)] font-medium">Camera Off</span>
                </div>

                <div className={`absolute bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white/90 font-medium z-20 ${
                  layoutMode === "split" ? "top-3 left-3" : "top-2 left-2"
                }`}>You</div>
              </div>
            </div>
          )}

          {/* ── Compact Control Bar (Camera + Mic + End + Hands-free) ── */}
          {layoutMode !== "phone" && (
            <div className="flex-shrink-0 flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--color-bg)] border-t border-[var(--color-border)] z-20">
              
              <button
                onClick={toggleCamera}
                title={cameraOn ? "Turn camera off" : "Turn camera on (with Edge Facial HUD)"}
                className={`relative w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  cameraOn
                    ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)] shadow-sm"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                }`}
              >
                {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleMic}
                title={isListening ? "Stop listening" : "Start voice input"}
                className={`relative w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  isListening
                    ? "bg-[var(--color-success)]/15 border-[var(--color-success)]/40 text-[var(--color-success)] shadow-sm animate-[pulse_1.5s_ease-in-out_infinite]"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                }`}
              >
                {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                {isListening && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--color-success)] rounded-full border border-[var(--color-bg)]" />
                )}
              </button>

              <button
                onClick={toggleTTS}
                title={ttsEnabled ? "Mute AI Voice" : "Unmute AI Voice"}
                className={`relative w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  ttsEnabled
                    ? "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50"
                }`}
              >
                {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

              <button
                onClick={() => setShowEndConfirm(true)}
                disabled={ending}
                title="End session"
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-200 border bg-[var(--color-danger)]/8 border-[var(--color-danger)]/25 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/15 hover:border-[var(--color-danger)]/40 disabled:opacity-40"
              >
                {ending
                  ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <PhoneOff className="w-4 h-4" />
                }
              </button>
            </div>
          )}
        </div>

        {/* ── Right Sidebar: Conversation Chat ── */}
        <div className={`flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-300 overflow-hidden z-20 ${
          sidebarOpen
            ? "absolute inset-0 xl:relative xl:inset-auto xl:w-[360px] 2xl:w-[400px] opacity-100 flex-shrink-0"
            : "w-0 opacity-0 pointer-events-none"
        }`}>

          <div className="flex items-center justify-between p-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] flex-shrink-0">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-[var(--color-text)]">
              <MessageSquare className="w-3.5 h-3.5 text-[var(--color-accent)]" /> Conversation
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="min-w-10 min-h-10 flex items-center justify-center text-[var(--color-text-subtle)] hover:text-[var(--color-text)] rounded-lg hover:bg-[var(--color-surface)] transition-colors"
              title="Hide panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Prospect Live Status & Trust Meter in Conversation Sidebar */}
          <div className="px-3 py-2 bg-[var(--color-bg)]/80 border-b border-[var(--color-border)] flex items-center justify-between gap-2 flex-shrink-0 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-[var(--color-text-subtle)] font-medium">Stage:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize border truncate ${
                customerState.stage === "decided" ? "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/30" :
                customerState.stage === "negotiating" ? "bg-blue-500/10 text-blue-500 border-blue-500/30" :
                customerState.stage === "interested" ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30" :
                customerState.stage === "warming" ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)]"
              }`}>
                {customerState.stage || "Cold"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-[var(--color-text-subtle)] font-medium">Trust:</span>
              <div className="w-14 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    trustPct > 60 ? "bg-[var(--color-success)]" : trustPct > 30 ? "bg-[var(--color-warning)]" : "bg-[var(--color-danger)]"
                  }`}
                  style={{ width: `${trustPct}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-[var(--color-text)] w-7 text-right">{trustPct}%</span>
            </div>
          </div>

          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Messages list */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-subtle)] gap-3 py-12">
                  <Bot className="w-10 h-10 opacity-20" />
                  <p className="text-xs text-center">The AI customer is waiting. Say hello!</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === "hint" ? "bg-[var(--color-warning)]/20 border border-[var(--color-warning)]/30" :
                    msg.role === "user" ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface)] border border-[var(--color-border)]"
                  }`}>
                    {msg.role === "hint" ? <Lightbulb className="w-3 h-3 text-[var(--color-warning)]" /> :
                     msg.role === "user" ? <User className="w-3 h-3 text-white" /> : <Bot className="w-3 h-3 text-[var(--color-text-muted)]" />}
                  </div>
                  <div className="flex flex-col max-w-[78%]">
                    <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                      msg.role === "hint"
                        ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/30 rounded-bl-sm"
                        : msg.role === "user"
                        ? "bg-[var(--color-accent)] text-white rounded-br-sm"
                        : "bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded-bl-sm"
                    }`}>
                      {msg.content}
                    </div>
                    {msg.role === "assistant" && msg.trustDelta !== undefined && msg.trustDelta !== null && msg.trustDelta !== 0 && (
                      <span className={`text-[9px] mt-0.5 font-semibold ${msg.trustDelta > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                        {msg.trustDelta > 0 ? `+${msg.trustDelta.toFixed(1)}` : msg.trustDelta.toFixed(1)} Trust
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading typing indicator */}
              {loading && (
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl rounded-bl-sm px-3 py-2">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-1.5 h-1.5 bg-[var(--color-text-subtle)] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Area */}
            <div className="flex-shrink-0 border-t border-[var(--color-border)] p-2.5 bg-[var(--color-bg)]">
              {isListening && (
                <div className="mb-2 px-2.5 py-1.5 bg-[var(--color-success)]/8 border border-[var(--color-success)]/20 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                    <span className="text-[10px] text-[var(--color-success)] font-medium">
                      {FEATURE_FLAGS.HANDS_FREE_AUTO_SEND && handsFreeMode ? "🎙️ Hands-Free Listening (Auto-sends on pause)" : "Listening… speak freely"}
                    </span>
                  </div>
                  {FEATURE_FLAGS.FULL_DUPLEX_VOICE && ttsSpeaking && (
                    <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">
                      Interrupt Ready
                    </span>
                  )}
                </div>
              )}

              {/* 1.2 Proactive Silence Detection Whisper Card */}
              {proactiveHint && !input.trim() && !isListening && (
                <div className="mb-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 shadow-sm animate-in fade-in duration-200">
                  <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Bisikan Pelatih Otomatis (Hening {salesSilenceSeconds}d)
                      </span>
                      <button
                        type="button"
                        onClick={() => setProactiveHint(null)}
                        className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      >
                        Tutup
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--color-text)] mt-0.5 leading-relaxed font-medium">
                      {proactiveHint}
                    </p>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setInput(proactiveHint);
                          setProactiveHint(null);
                        }}
                        className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded font-semibold transition-colors"
                      >
                        Gunakan Saran Respon Ini
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className={`flex items-end gap-1.5 bg-[var(--color-surface)] border rounded-2xl px-1 py-1 transition-all duration-200 ${
                isListening
                  ? "border-[var(--color-success)]/50 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success)_8%,transparent)]"
                  : "border-[var(--color-border)] focus-within:border-[var(--color-border-strong)]"
              }`}>
                <textarea
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={isListening ? "Listening to voice input…" : "Type or speak to the prospect…"}
                  className="flex-1 min-w-0 bg-transparent text-[12px] text-[var(--color-text)] placeholder-[var(--color-text-subtle)] resize-none outline-none max-h-20 min-h-[36px] py-2 px-2 custom-scrollbar leading-relaxed"
                  rows={1}
                />
                <button
                  title={
                    cooldownRemaining > 0
                      ? `Cooldown: ${cooldownRemaining}s`
                      : hintsUsed < 2
                        ? `Request Hint (${2 - hintsUsed} free remaining)`
                        : `Request Hint (-5 points penalty)`
                  }
                  onClick={requestHint}
                  disabled={hintLoading || cooldownRemaining > 0 || loading || shouldEnd}
                  className={`min-w-10 min-h-10 flex items-center justify-center gap-1.5 mb-0.5 px-2 sm:px-3 rounded-xl transition-all font-semibold text-xs flex-shrink-0 ${
                    cooldownRemaining > 0 
                      ? "bg-[var(--color-bg)] text-[var(--color-text-muted)] cursor-not-allowed border border-[var(--color-border)]"
                      : "bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20 border border-[var(--color-warning)]/30"
                  } disabled:opacity-50`}
                >
                  {hintLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : cooldownRemaining > 0 ? (
                    <span>00:{cooldownRemaining.toString().padStart(2, '0')}</span>
                  ) : (
                    <Lightbulb className="w-4 h-4" />
                  )}
                </button>
                <button
                  id="send-msg-btn"
                  onClick={sendMessage}
                  disabled={!input.trim() || loading || shouldEnd}
                  className={`min-w-10 min-h-10 mb-0.5 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    input.trim() && !loading && !shouldEnd
                      ? "bg-[var(--color-accent)] text-white shadow-sm hover:brightness-110 active:scale-95"
                      : "bg-[var(--color-border)] text-[var(--color-text-subtle)] cursor-not-allowed"
                  }`}
                >
                  {loading
                    ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Floating edge toggle when sidebar is closed */}
        {!sidebarOpen && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-30">
            <button
              onClick={() => setSidebarOpen(true)}
              className="min-w-10 min-h-10 bg-[var(--color-surface)] border border-[var(--color-border)] border-r-0 rounded-l-xl flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)] shadow-md transition-all"
              title="Show Conversation"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes soundbar {
          from { transform: scaleY(0.3); opacity: 0.6; }
          to   { transform: scaleY(1.0); opacity: 1.0; }
        }
      `}</style>

      <ConfirmModal
        isOpen={showEndConfirm}
        title="End Session"
        message="Are you sure you want to end this session and view your results?"
        confirmText="End Session"
        onConfirm={endSession}
        onCancel={() => setShowEndConfirm(false)}
        isLoading={ending}
      />
    </div>
  );
}
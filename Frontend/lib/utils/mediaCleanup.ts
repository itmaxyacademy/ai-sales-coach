/**
 * Global Hardware Media Lifecycle Registry & Teardown
 * Ensures all MediaStream tracks (Camera & Mic) and SpeechRecognition
 * instances are completely and irreversibly terminated when navigating,
 * logging out, or unmounting pages.
 */

declare global {
  interface Window {
    __ACTIVE_MEDIA_STREAMS__?: MediaStream[];
    __ACTIVE_SPEECH_RECOGNITION__?: any[];
  }
}

export function registerActiveStream(stream: MediaStream | null | undefined): void {
  if (typeof window === "undefined" || !stream) return;
  if (!window.__ACTIVE_MEDIA_STREAMS__) {
    window.__ACTIVE_MEDIA_STREAMS__ = [];
  }
  if (!window.__ACTIVE_MEDIA_STREAMS__.includes(stream)) {
    window.__ACTIVE_MEDIA_STREAMS__.push(stream);
  }
}

export function unregisterActiveStream(stream: MediaStream | null | undefined): void {
  if (typeof window === "undefined" || !stream || !window.__ACTIVE_MEDIA_STREAMS__) return;
  window.__ACTIVE_MEDIA_STREAMS__ = window.__ACTIVE_MEDIA_STREAMS__.filter((s) => s !== stream);
}

export function registerActiveRecognition(rec: any): void {
  if (typeof window === "undefined" || !rec) return;
  if (!window.__ACTIVE_SPEECH_RECOGNITION__) {
    window.__ACTIVE_SPEECH_RECOGNITION__ = [];
  }
  if (!window.__ACTIVE_SPEECH_RECOGNITION__.includes(rec)) {
    window.__ACTIVE_SPEECH_RECOGNITION__.push(rec);
  }
}

export function unregisterActiveRecognition(rec: any): void {
  if (typeof window === "undefined" || !rec || !window.__ACTIVE_SPEECH_RECOGNITION__) return;
  window.__ACTIVE_SPEECH_RECOGNITION__ = window.__ACTIVE_SPEECH_RECOGNITION__.filter((r) => r !== rec);
}

export function stopAllHardwareMedia(): void {
  if (typeof window === "undefined") return;

  // 1. Force kill all active SpeechRecognition instances
  if (window.__ACTIVE_SPEECH_RECOGNITION__) {
    const recs = [...window.__ACTIVE_SPEECH_RECOGNITION__];
    window.__ACTIVE_SPEECH_RECOGNITION__ = [];
    recs.forEach((rec) => {
      try {
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        rec.onstart = null;
        rec.abort?.();
        rec.stop?.();
      } catch {}
    });
  }

  // 2. Force kill all registered MediaStreams (Camera & Mic tracks)
  if (window.__ACTIVE_MEDIA_STREAMS__) {
    const streams = [...window.__ACTIVE_MEDIA_STREAMS__];
    window.__ACTIVE_MEDIA_STREAMS__ = [];
    streams.forEach((stream) => {
      try {
        if (stream && typeof stream.getTracks === "function") {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
              track.enabled = false;
            } catch {}
          });
        }
      } catch {}
    });
  }

  // 3. Inspect DOM for any media elements with active MediaStreams
  try {
    document.querySelectorAll("video, audio").forEach((el) => {
      const mediaEl = el as HTMLMediaElement;
      if (mediaEl.srcObject && mediaEl.srcObject instanceof MediaStream) {
        mediaEl.srcObject.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {}
        });
        mediaEl.srcObject = null;
      }
    });
  } catch {}
}

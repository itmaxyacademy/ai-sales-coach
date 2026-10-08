// src/app/components/PerformanceDashboard.tsx
import { useEffect, useState, useRef } from 'react';

/**
 * Real‑time performance monitor displaying FPS and (optional) audio latency.
 * It can be placed in the result page or any debugging overlay.
 */
export function PerformanceDashboard({ onLatencyUpdate }: { onLatencyUpdate?: (ms: number) => void }) {
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    let animId: number;
    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      const delta = now - lastTime.current;
      if (delta >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / delta));
        frameCount.current = 0;
        lastTime.current = now;
      }
      animId = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Measure real network round-trip latency against backend health endpoint
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const measureLatency = async () => {
      const start = performance.now();
      try {
        const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const rootHealthUrl = rawApiUrl.replace(/\/api\/?$/, '/health');
        const res = await fetch(rootHealthUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        }).catch(() =>
          fetch(`${rawApiUrl.replace(/\/$/, '')}/health`, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
          })
        );

        if (res && res.ok && isMounted) {
          const duration = Math.round(performance.now() - start);
          setLatency(duration);
          onLatencyUpdate?.(duration);
        }
      } catch {
        // Ignore network errors or aborted fetches
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 3000);

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [onLatencyUpdate]);

  return (
    <div className="p-2 bg-[var(--color-surface)] rounded-md shadow-sm text-sm flex items-center gap-4">
      <span className="font-mono">FPS: {fps}</span>
      <span className="font-mono text-xs text-[var(--color-text-muted)]">
        Latency: {latency !== null ? `${latency} ms` : 'Measuring...'}
      </span>
    </div>
  );
}

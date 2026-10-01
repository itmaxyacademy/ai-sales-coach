// src/app/featureFlags.ts
/**
 * Centralised feature‑flag definitions.
 * Values are read from environment variables (NEXT_PUBLIC_*) at build time.
 * Defaults are ON so voice features ship enabled; set the env var to "false" to disable.
 */
function envFlag(value: string | undefined, defaultOn = true): boolean {
  if (value === undefined || value === '') return defaultOn;
  return value === 'true';
}

export const FEATURE_FLAGS = {
  FULL_DUPLEX_VOICE: envFlag(process.env.NEXT_PUBLIC_FEATURE_FULL_DUPLEX),
  LIVE_FILLER_ALERT: envFlag(process.env.NEXT_PUBLIC_FEATURE_LIVE_FILLER),
  HANDS_FREE_AUTO_SEND: envFlag(process.env.NEXT_PUBLIC_FEATURE_HANDS_FREE),
};

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

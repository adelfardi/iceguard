/**
 * Public read-only demo: the UI shows a banner and refuses writes client-side with a clear message.
 * The real guard is server-side (e.g. the reverse proxy).
 *
 * Enabled at runtime with ICEGUARD_DEMO_MODE=true on the frontend container (nginx serves it as
 * /config.js), or in local dev with VITE_DEMO_MODE=true in frontend/.env.
 */
declare global {
  interface Window {
    __ICEGUARD_CONFIG__?: { demoMode?: boolean };
  }
}

export const DEMO_MODE =
  window.__ICEGUARD_CONFIG__?.demoMode === true || import.meta.env.VITE_DEMO_MODE === 'true';

export const DEMO_READ_ONLY_MESSAGE = 'This is a read-only demo: changes are disabled.';

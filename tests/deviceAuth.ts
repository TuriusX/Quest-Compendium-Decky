/**
 * Device-code sign-in for TVs / handhelds (used by the Steam Deck plugin).
 *
 * Flow:
 *   1. Device  -> POST /api/device/start    gets { deviceCode (secret), userCode (shown to user), verificationUrl }
 *   2. User    -> opens verificationUrl (QR code) on a phone/PC, signs in with Google on /link,
 *                 which calls POST /api/device/approve with the user's Firebase ID token
 *   3. Device  -> POST /api/device/poll     until approved; receives a Firebase ID token + refresh token
 *   4. Device  -> POST /api/device/refresh  every ~hour to get a fresh ID token
 *
 * The tokens are ordinary Firebase tokens for the SAME uid as the user's Google sign-in, so the rest of
 * the server (requireAuth, Firestore rules, Stripe lookup by email) needs no changes.
 *
 * Pending codes live in memory (like guestQuotas). If Cloud Run runs several instances, start/poll/approve
 * may land on different ones and the user would see "code expired" - retrying fixes it. For a launch, set
 * max-instances=1 or move the pending map to Firestore.
 */
import crypto from 'crypto';
import type { Express, Request, RequestHandler, Response } from 'express';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
}

export interface DeviceAuthDeps {
  /** firebase-admin getAuth, used only for createCustomToken(uid). */
  getAuth: () => { createCustomToken(uid: string): Promise<string> };
  /** Your existing requireAuth middleware (sets req.user to the decoded Firebase token). */
  requireAuth: RequestHandler;
  /** Public Firebase web config (same values as src/lib/firebase.ts). Used for REST token exchange and /link. */
  firebaseWebConfig: FirebaseWebConfig;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. */
  now?: () => number;
}

interface PendingDevice {
  userCode: string;
  expiresAt: number;
  uid?: string;
  email?: string;
}

const CODE_TTL_MS = 10 * 60 * 1000;
const POLL_INTERVAL_S = 3;
const MAX_PENDING = 2000;
// No 0/O/1/I/L: easy to read off a screen and to type on a phone.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomUserCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function normalizeUserCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Fixed-window limiter. Returns true when the action is allowed. */
function makeLimiter(max: number, windowMs: number, now: () => number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return {
    take(key: string): boolean {
      const t = now();
      const h = hits.get(key);
      if (!h || t >= h.reset) {
        hits.set(key, { n: 1, reset: t + windowMs });
        return true;
      }
      h.n += 1;
      return h.n <= max;
    },
    purge() {
      const t = now();
      for (const [k, v] of hits) if (t >= v.reset) hits.delete(k);
    },
  };
}

function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

export function registerDeviceAuth(app: Express, deps: DeviceAuthDeps): void {
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const { apiKey } = deps.firebaseWebConfig;

  const byDeviceCode = new Map<string, PendingDevice>();
  const deviceCodeByUserCode = new Map<string, string>();

  const startLimiter = makeLimiter(20, 10 * 60 * 1000, now);
  const pollLimiter = makeLimiter(40, 60 * 1000, now);
  const refreshLimiter = makeLimiter(30, 60 * 1000, now);
  const approveFailLimiter = makeLimiter(8, 10 * 60 * 1000, now);

  function dropPending(deviceCode: string) {
    const p = byDeviceCode.get(deviceCode);
    if (p) deviceCodeByUserCode.delete(p.userCode);
    byDeviceCode.delete(deviceCode);
  }

  function purgeExpired() {
    const t = now();
    for (const [dc, p] of byDeviceCode) if (t >= p.expiresAt) dropPending(dc);
    startLimiter.purge();
    pollLimiter.purge();
    refreshLimiter.purge();
    approveFailLimiter.purge();
  }
  setInterval(purgeExpired, 60 * 1000).unref();

  const baseUrl = (req: Request): string => {
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    return `${String(proto).split(',')[0]}://${String(host).split(',')[0]}`;
  };

  // 1. Device asks for a code -----------------------------------------------------------------
  app.post('/api/device/start', (req: Request, res: Response) => {
    if (!startLimiter.take(clientIp(req))) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    }
    purgeExpired();
    if (byDeviceCode.size >= MAX_PENDING) {
      return res.status(503).json({ error: 'Busy right now. Please try again shortly.' });
    }

    let userCode = randomUserCode();
    while (deviceCodeByUserCode.has(userCode)) userCode = randomUserCode();
    const deviceCode = crypto.randomBytes(32).toString('base64url');

    byDeviceCode.set(deviceCode, { userCode, expiresAt: now() + CODE_TTL_MS });
    deviceCodeByUserCode.set(userCode, deviceCode);

    res.json({
      deviceCode,
      userCode,
      verificationUrl: `${baseUrl(req)}/link?code=${encodeURIComponent(userCode)}`,
      expiresIn: Math.floor(CODE_TTL_MS / 1000),
      interval: POLL_INTERVAL_S,
    });
  });

  // 2. Signed-in user approves the code (called by the /link page) ------------------------------
  app.post('/api/device/approve', deps.requireAuth, (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.isGuest || String(user.uid).startsWith('guest_')) {
      return res.status(403).json({ error: 'Please sign in with Google to link a device.' });
    }
    if (!approveFailLimiter.take(`uid:${user.uid}`) ) {
      return res.status(429).json({ error: 'Too many wrong codes. Please wait a few minutes.' });
    }

    const userCode = normalizeUserCode(req.body?.userCode);
    const deviceCode = userCode ? deviceCodeByUserCode.get(userCode) : undefined;
    const pending = deviceCode ? byDeviceCode.get(deviceCode) : undefined;
    if (!pending || now() >= pending.expiresAt) {
      return res.status(404).json({ error: 'That code is invalid or has expired. Check your Deck for a new one.' });
    }
    if (pending.uid) {
      return res.status(409).json({ error: 'That code was already used.' });
    }

    pending.uid = user.uid;
    pending.email = typeof user.email === 'string' ? user.email : undefined;
    res.json({ ok: true, email: pending.email ?? null });
  });

  // 3. Device polls until approved --------------------------------------------------------------
  app.post('/api/device/poll', async (req: Request, res: Response) => {
    const deviceCode = typeof req.body?.deviceCode === 'string' ? req.body.deviceCode : '';
    if (!deviceCode || !pollLimiter.take(deviceCode)) {
      return res.status(429).json({ error: 'Polling too fast.' });
    }
    const pending = byDeviceCode.get(deviceCode);
    if (!pending || now() >= pending.expiresAt) {
      if (pending) dropPending(deviceCode);
      return res.json({ status: 'expired' });
    }
    if (!pending.uid) return res.json({ status: 'pending' });

    try {
      const customToken = await deps.getAuth().createCustomToken(pending.uid);
      const r = await doFetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: customToken, returnSecureToken: true }),
        },
      );
      const body: any = await r.json().catch(() => ({}));
      if (!r.ok || !body.idToken || !body.refreshToken) {
        console.error('[device] signInWithCustomToken failed:', r.status, body?.error?.message);
        return res.status(502).json({ error: 'Could not finish signing in. Please try again.' });
      }
      dropPending(deviceCode); // single use
      return res.json({
        status: 'linked',
        idToken: body.idToken,
        refreshToken: body.refreshToken,
        expiresIn: Number(body.expiresIn) || 3600,
        email: pending.email ?? null,
      });
    } catch (err: any) {
      // Most common cause on Cloud Run: the runtime service account lacks the
      // "Service Account Token Creator" role, so createCustomToken cannot sign.
      console.error('[device] createCustomToken failed:', err?.code || err?.message);
      return res.status(500).json({ error: 'Could not finish signing in. Please try again later.' });
    }
  });

  // 4. Device refreshes its ID token -------------------------------------------------------------
  app.post('/api/device/refresh', async (req: Request, res: Response) => {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
    if (!refreshLimiter.take(clientIp(req))) {
      return res.status(429).json({ error: 'Too many refresh attempts.' });
    }
    try {
      const r = await doFetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
      });
      const body: any = await r.json().catch(() => ({}));
      if (r.ok && body.id_token) {
        return res.json({
          idToken: body.id_token,
          refreshToken: body.refresh_token || refreshToken,
          expiresIn: Number(body.expires_in) || 3600,
        });
      }
      // 4xx from Google = the refresh token is dead (revoked, user disabled, expired): tell the device to re-link.
      if (r.status >= 400 && r.status < 500) {
        return res.status(401).json({ error: 'Sign-in expired. Please link your account again.' });
      }
      return res.status(502).json({ error: 'Could not refresh sign-in. Please try again.' });
    } catch {
      return res.status(502).json({ error: 'Could not refresh sign-in. Please try again.' });
    }
  });

  // The page users land on after scanning the QR code -------------------------------------------
  app.get('/link', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.send(renderLinkPage(deps.firebaseWebConfig));
  });
}

function renderLinkPage(config: FirebaseWebConfig): string {
  // JSON in a <script>: escape "<" so a value can never close the tag.
  const cfg = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link your device · Quest Compendium</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #070709; color: #f4f4f5;
         font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
  main { width: 100%; max-width: 420px; text-align: center; }
  h1 { font-size: 1.6rem; margin: 0 0 8px; }
  p { color: #a1a1aa; line-height: 1.5; margin: 0 0 20px; }
  input { width: 100%; padding: 16px; font-size: 1.6rem; letter-spacing: .25em; text-align: center; text-transform: uppercase;
          border-radius: 12px; border: 1px solid #3f3f46; background: #18181b; color: #fff; margin-bottom: 16px; }
  input:focus { outline: 2px solid #a87ffb; border-color: transparent; }
  button { width: 100%; padding: 16px; font-size: 1.05rem; font-weight: 600; border: 0; border-radius: 999px;
           background: #a87ffb; color: #0b0b0f; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  #msg { margin-top: 20px; min-height: 1.5em; }
  .ok { color: #4ade80; } .err { color: #f87171; }
</style>
</head>
<body>
<main>
  <h1>Link your Steam Deck</h1>
  <p>Enter the code shown on your device, then sign in with Google to connect your Quest Compendium account.</p>
  <input id="code" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="ABCD-EFGH" aria-label="Device code">
  <button id="go">Sign in with Google &amp; link</button>
  <p id="msg" role="status"></p>
</main>
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
  import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

  const auth = getAuth(initializeApp(${cfg}));
  const $ = (id) => document.getElementById(id);
  const msg = (text, cls) => { $('msg').textContent = text; $('msg').className = cls || ''; };

  $('code').value = (new URLSearchParams(location.search).get('code') || '').toUpperCase().slice(0, 9);

  $('go').addEventListener('click', async () => {
    const code = $('code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) return msg('Enter the 8-character code from your device.', 'err');
    $('go').disabled = true;
    msg('Opening Google sign-in…');
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();
      msg('Linking…');
      const r = await fetch('/api/device/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ userCode: code }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) {
        msg('All set! You can go back to your device.', 'ok');
        await signOut(auth).catch(() => {});
        return;
      }
      msg(body.error || 'Something went wrong. Please try again.', 'err');
    } catch (e) {
      msg(e && e.code === 'auth/popup-closed-by-user' ? 'Sign-in was cancelled.' : 'Sign-in failed. Please try again.', 'err');
    }
    $('go').disabled = false;
  });
</script>
</body>
</html>`;
}

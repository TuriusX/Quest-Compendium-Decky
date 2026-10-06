// Test harness: real Express + the real deviceAuth module, with FAKE Firebase/Google and a
// /api/chat that mirrors the contract in the real server.ts (auth, quotas, payload fields).
import express from 'express';
import { registerDeviceAuth } from './deviceAuth.ts';

const port = Number(process.argv[2] || 3111);
const app = express();
app.use(express.json({ limit: '50mb' }));

// ---- fake Firebase state ----
const validIdTokens = new Map<string, { uid: string; email: string }>();
const revokedRefresh = new Set<string>();
let counter = 0;
const mintIdToken = (uid: string, email: string) => {
  const t = `id_${uid}_${++counter}`;
  validIdTokens.set(t, { uid, email });
  return t;
};
const emailOf = (uid: string) => `${uid}@example.com`;

// ---- same behavior as the real requireAuth ----
const requireAuth: express.RequestHandler = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  const token = h.split('Bearer ')[1];
  if (token.startsWith('guest_')) {
    (req as any).user = { uid: token, email: undefined, isGuest: true };
    return next();
  }
  const rec = validIdTokens.get(token);
  if (!rec) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  (req as any).user = { uid: rec.uid, email: rec.email };
  next();
};

// ---- fake Google REST endpoints, injected as fetchImpl ----
const fakeFetch: typeof fetch = async (input: any, init?: any) => {
  const url = String(input);
  const json = (status: number, body: any) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.includes('identitytoolkit.googleapis.com') && url.includes('signInWithCustomToken')) {
    const { token } = JSON.parse(init.body);
    if (!String(token).startsWith('custom_')) return json(400, { error: { message: 'INVALID_CUSTOM_TOKEN' } });
    const uid = String(token).slice('custom_'.length);
    return json(200, { idToken: mintIdToken(uid, emailOf(uid)), refreshToken: `rt_${uid}`, expiresIn: '3600' });
  }
  if (url.includes('securetoken.googleapis.com')) {
    const rt = new URLSearchParams(init.body).get('refresh_token') || '';
    if (!rt.startsWith('rt_') || revokedRefresh.has(rt)) return json(400, { error: { message: 'TOKEN_EXPIRED' } });
    const uid = rt.slice(3);
    return json(200, { id_token: mintIdToken(uid, emailOf(uid)), refresh_token: rt, expires_in: '3600' });
  }
  return json(404, {});
};

registerDeviceAuth(app, {
  getAuth: () => ({ createCustomToken: async (uid: string) => `custom_${uid}` }),
  requireAuth,
  firebaseWebConfig: { apiKey: 'TEST_KEY', authDomain: 'test.firebaseapp.com', projectId: 'test' },
  fetchImpl: fakeFetch,
});

// ---- mirror of the real /api/user/status and /api/chat contract ----
const quotas = new Map<string, { pro: number; flash: number }>();
const quotaFor = (uid: string, isGuest: boolean) => {
  if (!quotas.has(uid)) quotas.set(uid, isGuest ? { pro: 5, flash: 5 } : { pro: 40, flash: 1000 });
  return quotas.get(uid)!;
};
app.get('/api/user/status', requireAuth, (req, res) => {
  const u = (req as any).user;
  const isGuest = !!u.isGuest;
  const q = quotaFor(u.uid, isGuest);
  res.json({ isPremium: !isGuest, proQueriesAvailable: q.pro, flashQueriesAvailable: q.flash, isGuest });
});
app.post('/api/chat', requireAuth, (req, res) => {
  const u = (req as any).user;
  const isGuest = !!u.isGuest;
  const { question, history = [], imageBase64, aiMode = 'standard', preferredModel = 'pro', activeGame, isGameRunningLocally, language, quick } = req.body;
  if (!question && !imageBase64) return res.status(400).json({ error: 'Question or image is required' });
  if (imageBase64 && !/^data:(image\/[a-zA-Z+]+);base64,(.+)$/.test(imageBase64)) {
    return res.status(500).json({ error: 'bad image data URL' });
  }
  const q = quotaFor(u.uid, isGuest);
  const key = preferredModel === 'flash' ? 'flash' : 'pro';
  if (q[key] <= 0) return res.status(429).json({ text: 'Daily limit reached.', modelUsed: 'Limit Reached' });
  q[key] -= 1;
  res.json({
    text: `echo|mode=${aiMode}|model=${preferredModel}|image=${imageBase64 ? imageBase64.split(';')[0].slice(5) : 'none'}|game=${activeGame?.name ?? 'none'}|running=${!!isGameRunningLocally}|hist=${history.length}|lang=${language}|quick=${quick ?? 'none'}|uid=${u.uid}`,
    modelUsed: preferredModel,
    userData: { isPremium: !isGuest, proQueriesAvailable: q.pro, flashQueriesAvailable: q.flash, isGuest },
  });
});

// ---- test controls ----
app.post('/__test/mint', (req, res) => { const uid = String(req.body?.uid || 'alice'); res.json({ idToken: mintIdToken(uid, emailOf(uid)) }); });
app.post('/__test/expire-id-tokens', (_req, res) => { validIdTokens.clear(); res.json({ ok: true }); });
app.post('/__test/revoke-refresh', (_req, res) => { for (const u of ['alice']) revokedRefresh.add(`rt_${u}`); res.json({ ok: true }); });

app.listen(port, '127.0.0.1', () => console.log('READY'));

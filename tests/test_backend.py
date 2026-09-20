"""End-to-end test: the REAL plugin backend (main.py) against the REAL deviceAuth module running in Express,
with fake Firebase/Google, a fake slow-writing gamescopectl, and real ffmpeg."""
import asyncio, glob, os, stat, struct, subprocess, sys, tempfile, time, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 3111
BASE = f"http://127.0.0.1:{PORT}"
sys.path.insert(0, os.path.join(HERE, "fakes"))
sys.path.insert(0, os.path.join(HERE, ".."))

# --- a real, valid 1920x1080 PNG fixture -------------------------------------------------------
def make_png(w=1920, h=1080) -> bytes:
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    rows = b"".join(b"\x00" + bytes(((x * 255 // w), (y * 255 // h), 128) [i % 3] for x in range(w) for i in range(3)) for y in range(h))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 1)) + chunk(b"IEND", b""))

fixture = os.path.join(tempfile.mkdtemp(), "fixture.png")
open(fixture, "wb").write(make_png())
os.environ["QC_FIXTURE_PNG"] = fixture
os.environ["PATH"] = os.path.join(HERE, "fakebin") + ":" + os.environ["PATH"]

import aiohttp
import main  # the real plugin backend

results = []
def check(name, cond, detail=""):
    results.append(cond)
    print(("PASS  " if cond else "FAIL  ") + name + (f"   -> {detail}" if (detail and not cond) else ""))

async def post(path, body, token=None):
    async with aiohttp.ClientSession() as s:
        h = {"Authorization": f"Bearer {token}"} if token else {}
        async with s.post(BASE + path, json=body, headers=h) as r:
            try: return r.status, await r.json()
            except Exception: return r.status, {}

async def run():
    p = main.Plugin()
    await p._main()
    p.state["settings"]["api_base"] = BASE

    st = await p.get_state()
    check("initial: guest, defaults, tools detected", (not st["linked"]) and st["settings"]["mode"] == "standard"
          and st["tools"]["gamescopectl"] and st["tools"]["ffmpeg"], st)
    check("guest id is generated and persisted", p.state["guest_id"].startswith("guest_deck_"))

    q = await p.get_quota()
    check("guest quota 5/5", q["ok"] and q["quota"]["pro"] == 5 and q["quota"]["isGuest"], q)

    # ---- asking as a guest, no screenshot ----
    r = await p.ask({"question": "Where next?", "mode": "roleplay", "model": "pro", "includeScreenshot": False,
                     "game": {"name": "Elden Ring", "appId": 1245620},
                     "history": [{"role": "user", "text": "hi"}, {"role": "assistant", "text": "hello"}]})
    t = r.get("text", "")
    check("guest ask works; fields reach server", r["ok"] and "mode=roleplay" in t and "game=Elden Ring" in t
          and "running=true" in t and "image=none" in t and "hist=2" in t and "lang=English" in t, r)
    check("guest quota decremented and returned", r["quota"]["pro"] == 4 and r["quota"]["isGuest"], r)

    # ---- screenshot path: slow two-stage write + real ffmpeg -> JPEG ----
    before = set(glob.glob("/tmp/qc-*"))
    t0 = time.time()
    r = await p.ask({"question": "What is this?", "includeScreenshot": True})
    check("screenshot attached as JPEG via ffmpeg (paused write NOT mistaken for done)",
          r["ok"] and r["screenshot"] == "attached" and "image=image/jpeg" in r["text"], r)
    check("screenshot temp files cleaned up", set(glob.glob("/tmp/qc-*")) == before)
    test = await p.test_screenshot()
    check("test_screenshot reports size, does not return the image", test["ok"] and test["bytes"] > 1000 and "b64" not in test, test)
    shot = await p._capture()
    import base64, io
    jpg = base64.b64decode(shot["b64"])
    # JPEG dimensions: scan for SOF0/SOF2 marker
    i, w = 2, None
    while i < len(jpg):
        if jpg[i] != 0xFF: break
        m = jpg[i+1]; ln = struct.unpack(">H", jpg[i+2:i+4])[0]
        if m in (0xC0, 0xC2): w = struct.unpack(">H", jpg[i+7:i+9])[0]; break
        i += 2 + ln
    check("1920px capture is downscaled to <=1280px wide", w == 1280, f"width={w}")

    # ---- no ffmpeg -> falls back to raw PNG ----
    orig_which = main._which
    main._which = lambda name, env=None: None if name == "ffmpeg" else orig_which(name, env)
    r = await p.ask({"question": "png?", "includeScreenshot": True})
    check("without ffmpeg, sends PNG instead", r["ok"] and "image=image/png" in r["text"], r)
    main._which = orig_which

    # ---- gamescopectl failing -> graceful degrade, question still answered ----
    os.environ["QC_FAKE_GS_FAIL"] = "1"
    r = await p.ask({"question": "still answer me", "includeScreenshot": True})
    check("capture failure degrades gracefully (answer still returned, error surfaced)",
          r["ok"] and r["screenshot"] == "failed" and "image=none" in r["text"] and "gamescopectl failed" in (r["screenshotError"] or ""), r)
    del os.environ["QC_FAKE_GS_FAIL"]

    # ---- limits ----
    while (await p.get_quota())["quota"]["pro"] > 0:
        await p.ask({"question": "burn", "includeScreenshot": False})
    r = await p.ask({"question": "over the limit", "includeScreenshot": False})
    check("exhausted quota -> limitReached message (ok=True)", r["ok"] and r.get("limitReached") is True, r)

    # ---- validation ----
    check("empty question rejected", (await p.ask({"question": "   "}))["ok"] is False)
    await p.save_settings({"mode": "nonsense", "model": "flash", "include_screenshot": False})
    st = await p.get_state()
    check("settings: invalid value ignored, valid saved", st["settings"] == {"mode": "standard", "model": "flash", "include_screenshot": False}, st)
    await p.save_settings({"model": "pro", "include_screenshot": True})

    # ---- device linking ----
    link = await p.start_link()
    check("start_link returns code + URL", link["ok"] and len(link["userCode"]) == 9 and "/link?code=" in link["verificationUrl"], link)
    check("poll before approval -> pending", (await p.poll_link())["status"] == "pending")

    alice = (await post("/__test/mint", {"uid": "alice"}))[1]["idToken"]
    s, b = await post("/api/device/approve", {"userCode": "ZZZZ-ZZZZ"}, alice)
    check("approve with wrong code -> 404", s == 404, (s, b))
    s, b = await post("/api/device/approve", {"userCode": link["userCode"]}, p.state["guest_id"])
    check("guests cannot approve -> 403", s == 403, (s, b))
    s, b = await post("/api/device/approve", {"userCode": link["userCode"]})
    check("unauthenticated approve -> 401", s == 401, (s, b))
    s, b = await post("/api/device/approve", {"userCode": link["userCode"].lower().replace("-", " ")}, alice)
    check("approve accepts sloppy typing (lowercase, space) -> ok", s == 200 and b["email"] == "alice@example.com", (s, b))
    s, b = await post("/api/device/approve", {"userCode": link["userCode"]}, alice)
    check("approving the same code twice -> 409", s == 409, (s, b))

    pr = await p.poll_link()
    check("poll after approval -> linked", pr["status"] == "linked" and pr["email"] == "alice@example.com", pr)
    mode = stat.S_IMODE(os.stat(main.SETTINGS_PATH).st_mode)
    check("settings file with tokens is 0600", mode == 0o600, oct(mode))
    check("device code is single-use", (await p.poll_link())["status"] == "none")
    s, b = await post("/api/device/poll", {"deviceCode": "made-up"})
    check("unknown device code -> expired (no info leak)", b.get("status") == "expired", b)

    r = await p.ask({"question": "as alice", "includeScreenshot": False})
    check("linked ask uses alice's Firebase token + Premium quota", r["ok"] and "uid=alice" in r["text"] and r["quota"]["isPremium"] and not r["quota"]["isGuest"], r)

    # ---- token refresh ----
    old = p.state["auth"]["idToken"]
    p.state["auth"]["expiresAt"] = time.time() + 30   # inside the refresh margin
    r = await p.ask({"question": "refresh me", "includeScreenshot": False})
    check("near-expiry token is refreshed proactively", r["ok"] and p.state["auth"]["idToken"] != old, r)

    await post("/__test/expire-id-tokens", {})          # server now rejects the cached token
    r = await p.ask({"question": "401 then retry", "includeScreenshot": False})
    check("server 401 -> refresh once -> retry succeeds", r["ok"] and "uid=alice" in r["text"], r)

    await post("/__test/revoke-refresh", {})
    await post("/__test/expire-id-tokens", {})
    r = await p.ask({"question": "revoked", "includeScreenshot": False})
    st = await p.get_state()
    check("revoked account -> falls back to guest with a notice, flags relink",
          r.get("notice") and st["relinkNeeded"] and not st["linked"], (r, st))

    # ---- unlink / relink hygiene ----
    link2 = await p.start_link()
    await p.cancel_link()
    check("cancel_link clears pending", (await p.poll_link())["status"] == "none")
    await p.start_link()
    p.pending_link["expiresAt"] = time.time() - 1
    check("expired pending link reported as expired", (await p.poll_link())["status"] == "expired")

    # ---- server without the endpoint / HTML error pages ----
    st404, d404 = await p._http("POST", "/api/this-route-does-not-exist")
    check("HTML 404 from server never leaks markup into the UI error", st404 == 404 and "<" not in d404["error"] and "HTTP 404" in d404["error"], d404)
    real_http = p._http
    async def fake_404(*a, **k): return 404, {"error": "Unexpected response from the server (HTTP 404)."}
    p._http = fake_404
    r = await p.start_link()
    check("start_link on a server lacking device auth -> friendly message", (not r["ok"]) and "isn't available on the server yet" in r["error"] and "<" not in r["error"], r)
    p._http = real_http

    # ---- /link page ----
    async with aiohttp.ClientSession() as s:
        async with s.get(BASE + "/link?code=QQQQ-7777%3Cscript%3Ealert(1)%3C/script%3E") as r:
            html = await r.text()
            check("/link page served with Firebase SDK + config, no-store", r.status == 200 and "gstatic.com/firebasejs" in html
                  and "test.firebaseapp.com" in html and r.headers.get("Cache-Control") == "no-store", r.status)
            check("/link page reads code from query in JS (nothing user-supplied interpolated into HTML)", "QQQQ-7777" not in html and "alert(1)" not in html)

    # ---- rate limiting ----
    codes = [await post("/api/device/start", {}) for _ in range(25)]
    check("start endpoint is rate limited (429 after 20)", any(s == 429 for s, _ in codes), [s for s, _ in codes][-6:])

    print(f"\n{sum(results)}/{len(results)} checks passed")
    return all(results)

def main_():
    srv = subprocess.Popen(["npx", "tsx", "harness.ts", str(PORT)], cwd=HERE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        for _ in range(100):
            line = srv.stdout.readline()
            if "READY" in line: break
        else:
            print("server failed to start"); return 1
        ok = asyncio.run(run())
        return 0 if ok else 1
    finally:
        srv.terminate()

if __name__ == "__main__":
    sys.exit(main_())

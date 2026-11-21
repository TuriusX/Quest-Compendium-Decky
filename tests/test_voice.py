"""Voice that ends by itself (main.py VoiceEnd, voice_chunks, _watch_voice; the desktop's tests/voiceEnd.test.ts cases).
Run: python3 tests/test_voice.py"""
import asyncio, math, os, struct, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "fakes"))
sys.path.insert(0, os.path.join(HERE, ".."))
try:
    import aiohttp  # noqa: F401
except ImportError:
    import types
    sys.modules["aiohttp"] = types.ModuleType("aiohttp")

import main

failed = 0


def check(name, cond, extra=""):
    global failed
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else f"   -> {extra}"))
    if not cond:
        failed += 1


def run(level, **over):
    d = main.VoiceEnd()
    for k, v in over.items():
        setattr(d, k, v)
    t = 0
    while t <= 60000:
        s = d.step(level(t), t)
        if s != "listen":
            return s, t
        t += 50
    return "listen", -1


s, t = run(lambda t: 0.1 if 500 <= t < 2500 else 0.003)
check("talks 0.5-2.5 s then quiet: ends ~1.3 s after the last word", s == "end" and 3700 <= t <= 3900, (s, t))
s, t = run(lambda t: 0.1 if 500 <= t < 5000 and (t // 700) % 2 == 0 else 0.003)
check("short pauses between words don't end it", s == "end" and t > 5000, (s, t))
check("nothing said: stops without sending at 8 s", run(lambda t: 0.004) == ("nothing", 8000))
check("a click isn't talking", run(lambda t: 0.3 if 1000 <= t < 1100 else 0.003)[0] == "nothing")
check("a noisy room alone is nothing", run(lambda t: 0.03)[0] == "nothing")
check("a voice over a noisy room counts", run(lambda t: 0.15 if 600 <= t < 2000 else 0.03)[0] == "end")
check("talking right from the start counts", run(lambda t: 0.12 if t < 3000 else 0.003)[0] == "end")
check("talking non-stop: sent at 45 s", run(lambda t: 0.2, CALIBRATE_MS=0) == ("end", 45000))


def pcm(seconds, amp):
    """16 kHz mono s16: a tone at amp (0..1), or silence."""
    n = int(16000 * seconds)
    return struct.pack("<%dh" % n, *[int(amp * 32767 * math.sin(i / 3.0)) for i in range(n)])


# voice_chunks over raw PCM, fed in pieces as a recorder writes them.
d = main.VoiceEnd()
audio = pcm(0.4, 0) + pcm(1.5, 0.3) + pcm(2.0, 0)
state, seen = "listen", 0
for i in range(0, len(audio), 3200):  # 100 ms pieces
    part = audio[i:i + 3200]
    state = main.voice_chunks(d, part, seen)
    seen += len(part) // 2
    if state != "listen":
        break
check("PCM: quiet, speech, quiet -> end", state == "end", state)
check("PCM: ends about 1.3 s after the speech", 3.0 <= seen / 16000 <= 3.4, seen / 16000)


# _watch_voice against a WAV file that grows like a live recording.
async def watch_case(body: bytes):
    path = os.path.join(tempfile.gettempdir(), "qc-voice-test.wav")
    header = b"RIFF" + struct.pack("<I", 0) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, 16000, 32000, 2, 16) + b"data" + struct.pack("<I", 0)
    with open(path, "wb") as f:
        f.write(header)
    plugin = main.Plugin() if hasattr(main, "Plugin") else None
    rec = {"proc": None, "path": path, "started": 0, "voice": "listen"}
    plugin._recorder = rec
    task = asyncio.ensure_future(plugin._watch_voice(rec))
    for i in range(0, len(body), 6400):  # 200 ms written at a time
        with open(path, "ab") as f:
            f.write(body[i:i + 6400])
        await asyncio.sleep(0.02)
        if rec["voice"] != "listen":
            break
    for _ in range(30):
        if rec["voice"] != "listen":
            break
        await asyncio.sleep(0.1)
    task.cancel()
    st = (await plugin.voice_state())["state"]
    os.remove(path)
    return st


check("watcher: speech then quiet -> end", asyncio.run(watch_case(pcm(0.4, 0) + pcm(1.2, 0.3) + pcm(2.0, 0))) == "end")
check("watcher: silence -> nothing", asyncio.run(watch_case(pcm(9.0, 0))) == "nothing")

print("ALL PASSED" if not failed else f"{failed} FAILED")
sys.exit(1 if failed else 0)

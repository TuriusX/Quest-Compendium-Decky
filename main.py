"""Quest Compendium - Decky Loader plugin backend.

This plugin is a thin client. All AI work (Gemini, quotas, Premium checks) happens on the
Quest Compendium server. This backend only:

  1. captures the game frame with `gamescopectl screenshot` (game layer only, no overlays),
  2. talks to the Quest Compendium server, and
  3. stores the sign-in state on the Deck, and
  4. fetches web pages for the in-plugin reader browser (the frontend turns them into readable text).

Callable-from-frontend methods are the public `async def`s on `Plugin` (no leading underscore).
"""

import asyncio
import base64
import json
import math
import struct
import os
import pwd
import secrets
import re
import shutil
import signal
import tempfile
import uuid
import ipaddress
from urllib.parse import quote, urlsplit, urlencode
import ssl
import time
from asyncio.subprocess import DEVNULL, PIPE
from typing import Any, Dict, List, Optional, Tuple

import aiohttp
import decky

# ---------------------------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------------------------

DEFAULT_API_BASE = "https://quest-compendium-890629309063.us-east1.run.app"

CHAT_TIMEOUT_S = 120          # vision + thinking can take a while
SHORT_TIMEOUT_S = 20
# Guides: the list comes from the website's small index (published with the site), the server's list is the fallback;
# a guide's pages come from the server. Longer timeouts than other calls, each tried twice.
GUIDE_INDEX_URL = "https://questcompendium.com/guides/index.json"
# "Update available": the newest release on GitHub (manually installed plugins don't update by themselves).
RELEASES_API = "https://api.github.com/repos/TuriusX/Quest-Compendium-Decky/releases/latest"
INSTALL_URL = "https://github.com/TuriusX/Quest-Compendium-Decky/releases/latest/download/quest-compendium-decky.zip"
UPDATE_CHECK_S = 3 * 3600  # GitHub allows 60 unauthenticated calls an hour; one every few hours is plenty
UPDATE_RETRY_S = 30 * 60  # after a failed check (offline), try again later rather than on every panel open
GUIDE_INDEX_TIMEOUT_S = 30
GUIDE_TIMEOUT_S = 45
# One guide everywhere: the website publishes each guide page's data next to it (guides/{key}/guide.json and
# guides/{key}/{slug}/page.json), so the Deck shows what the site shows. Read first, with a short timeout because the
# server's /api/guides is still there behind it when the site is slow or a file is missing.
SITE_JSON_TIMEOUT_S = 8
# The languages the site is translated into (each under its own folder, e.g. /es/guides/...); others read English.
SITE_LANGS = ("es", "pt", "de", "fr", "ru", "ja", "ko", "zh")
TOKEN_REFRESH_MARGIN_S = 120  # refresh Firebase ID tokens this long before they expire

MAX_QUESTION_CHARS = 2000
# Hold to talk: a recorded voice question (16 kHz mono WAV, under a minute) as a data URL.
MAX_AUDIO_CHARS = 3_000_000


class VoiceEnd:
    """Voice that ends by itself (owner, Nov 20 2026; the desktop's src/utils/voiceEnd.ts, same numbers): fed the
    microphone's loudness (RMS, 0..1) with the time in ms, it says "listen", "end" (the player spoke and has been quiet
    for a moment, or talked for the longest a question may be) or "nothing" (nothing said in time). The room's own noise
    is measured first, so a fan or the game's sound doesn't count as talking."""

    CALIBRATE_MS = 250
    MIN_SPEECH_MS = 250
    SILENCE_MS = 1300
    NO_SPEECH_MS = 8000
    MAX_MS = 45000
    FLOOR = 0.012
    CEILING = 0.06
    FACTOR = 2.8

    def __init__(self) -> None:
        self.start = -1.0
        self.last_t = -1.0
        self.noise = 0.0
        self.samples = 0
        self.speech = 0.0
        self.last_loud = -1.0

    def step(self, level: float, t: float) -> str:
        if self.start < 0:
            self.start = t
        dt = 0.0 if self.last_t < 0 else max(0.0, t - self.last_t)
        self.last_t = t
        age = t - self.start
        v = max(0.0, float(level)) if level == level else 0.0
        if age < self.CALIBRATE_MS:
            self.noise = (self.noise * self.samples + v) / (self.samples + 1)
            self.samples += 1
            return "listen"
        threshold = max(self.FLOOR, min(self.CEILING, self.noise * self.FACTOR))
        if v >= threshold:
            self.speech += dt
            self.last_loud = t
        spoke = self.speech >= self.MIN_SPEECH_MS
        if spoke and t - self.last_loud >= self.SILENCE_MS:
            return "end"
        if age >= self.MAX_MS:
            return "end" if spoke else "nothing"
        if not spoke and age >= self.NO_SPEECH_MS:
            return "nothing"
        return "listen"


def voice_chunks(decide: "VoiceEnd", pcm_bytes: bytes, samples_before: int, rate: int = 16000) -> str:
    """Feeds 16-bit mono PCM to VoiceEnd 50 ms at a time (time counted from the samples); the first decision that isn't
    "listen", else "listen"."""
    n = len(pcm_bytes) // 2
    if not n:
        return "listen"
    pcm = struct.unpack("<%dh" % n, pcm_bytes[: n * 2])
    step = rate // 20
    seen = samples_before
    for i in range(0, n, step):
        chunk = pcm[i:i + step]
        seen += len(chunk)
        level = math.sqrt(sum(x * x for x in chunk) / len(chunk)) / 32768.0
        state = decide.step(level, seen * 1000.0 / rate)
        if state != "listen":
            return state
    return "listen"
MAX_HISTORY_TURNS = 10
MAX_HISTORY_CHARS = 4000
MAX_IMAGE_BYTES = 6 * 1024 * 1024
SCREENSHOT_MAX_WIDTH = 1280
MAX_CHECK_CROPS = 8           # the precision pass checks every marker an answer can have (8 in a fight)
MAX_CROP_CHARS = 600_000      # one 768 px JPEG close-up is far smaller

# In-plugin reader browser
PAGE_TIMEOUT_S = 20
MAX_PAGE_BYTES = 4 * 1024 * 1024
BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36"
)

# Min-Max was removed (owner, Nov 16 2026, as on the desktop): a style saved as Min-Max is Standard.
VALID_MODES = ("standard", "roleplay")


def _mode(m: Any) -> str:
    return m if m in VALID_MODES else "standard"
VALID_MODELS = ("pro", "flash")
VALID_LOCALES = ("auto", "en", "es", "pt", "de", "fr", "ru", "ja", "ko", "zh")
# The language names the server puts in the AI's instructions ("Respond entirely in ...").
# The quick questions' ids (src/quick.ts); the server adds what each one asks for.
QUICK_IDS = ("next", "stuck", "missable", "fight", "choice", "leave", "keep", "after", "where")  # (no hint questions since Nov 20 2026)
AI_LANGUAGES = ("English", "Spanish", "Brazilian Portuguese", "German", "French", "Russian", "Japanese", "Korean", "Simplified Chinese")
MAX_GUIDE_SITES = 12
DOMAIN_RE = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)+$")

SETTINGS_PATH = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")

DEFAULT_SETTINGS: Dict[str, Any] = {
    "mode": "standard",
    "model": "pro",
    "include_screenshot": True,
    # A game that starts brings back its own conversation (off: the current one stays, with "Switch").
    "auto_switch": True,
    "language": "English",
    # Interface + answer language: "auto" follows the Steam language.
    "locale": "auto",
    # "Where was I?" (session companion step 1): a recap at the top of the panel when a game starts after a day away.
    "recap": True,
    # Guide sites shown in the Guides tab (they open in Steam's browser).
    "guide_sites": ["gamefaqs.gamespot.com", "neoseeker.com", "fandom.com", "ign.com", "reddit.com", "youtube.com"],
    # Developer override, e.g. "http://192.168.1.20:3000" to test against a local server.
    "api_base": "",
}


# System CA bundles, in order of preference (SteamOS is Arch-based).
CA_BUNDLE_CANDIDATES = (
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/ca-certificates/extracted/tls-ca-bundle.pem",
    "/etc/pki/tls/certs/ca-bundle.crt",
)


def _make_ssl_context() -> Tuple[ssl.SSLContext, str]:
    """Verify server certificates against the SYSTEM trust store.

    Decky's bundled (PyInstaller) Python often cannot find a CA store, so the default context fails with
    ClientConnectorCertificateError on every HTTPS request. Verification stays ON; we just tell it where
    the OS certificates live.
    """
    for path in CA_BUNDLE_CANDIDATES:
        if os.path.isfile(path):
            try:
                return ssl.create_default_context(cafile=path), path
            except (ssl.SSLError, OSError):
                continue
    return ssl.create_default_context(), "python-default"


# ---------------------------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------------------------

def _read_json(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_json_private(path: str, data: Dict[str, Any]) -> None:
    """Atomic write, readable only by the owner (the file holds sign-in tokens)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(tmp, path)


def _target_uid() -> int:
    """The Deck user's uid. The backend normally runs as that user, but be defensive."""
    uid = os.getuid()
    if uid == 0:
        try:
            return pwd.getpwnam(decky.DECKY_USER).pw_uid
        except (KeyError, AttributeError, TypeError):
            pass
    return uid


def _clean_env() -> Dict[str, str]:
    """Environment for spawning system tools.

    The Decky loader is a PyInstaller binary: it points LD_LIBRARY_PATH at its own bundled libs,
    which makes system binaries (ffmpeg, gamescopectl) load the wrong libraries. It can also leave
    XDG_RUNTIME_DIR pointing at root's runtime dir. Rebuild both from the real user, and leave out every
    other dynamic-loader variable (LD_*), so the tools run with the system's own libraries only.
    """
    env = dict(os.environ)
    env["XDG_RUNTIME_DIR"] = f"/run/user/{_target_uid()}"
    orig = env.pop("LD_LIBRARY_PATH_ORIG", None)
    for key in [k for k in env if k.startswith("LD_")]:
        del env[key]
    if orig is not None:
        env["LD_LIBRARY_PATH"] = orig
    return env


def _which(name: str, env: Optional[Dict[str, str]] = None) -> Optional[str]:
    search = ((env or os.environ).get("PATH", "")) + ":/usr/bin:/usr/local/bin:/run/current-system/sw/bin"
    return shutil.which(name, path=search)


def _to_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _quota_from(user_data: Any) -> Optional[Dict[str, Any]]:
    """The day's questions: Pro and Fast left (the player picks one next to Send), each one's daily allowance, and when
    the day resets (ms). `left`/`daily` are the older single count (the Fast questions)."""
    if not isinstance(user_data, dict):
        return None
    left = user_data.get("questionsAvailable", user_data.get("flashQueriesAvailable"))
    out: Dict[str, Any] = {
        "left": _to_int(left),
        "daily": _to_int(user_data.get("dailyQuestions")),
        "isPremium": user_data.get("isPremium") is True,
        "isGuest": user_data.get("isGuest") is True,
    }
    for key, src in (("pro", "proQueriesAvailable"), ("fast", "flashQueriesAvailable"), ("dailyPro", "dailyPro"), ("dailyFast", "dailyFlash"), ("resetAt", "resetAt")):
        v = _to_int(user_data.get(src))
        if v is not None:
            out[key] = max(0, v)
    # In a free trial of Premium: when it ends (ms), for "Your trial ends tomorrow" the day before.
    trial_end = _to_int(user_data.get("premiumTrialEnd"))
    if trial_end:
        out["trialEnd"] = trial_end
    # Premium's carry-over: unused questions are kept, each model capped at bankCap (for the top-up countdown).
    if user_data.get("rollover") is True:
        out["rollover"] = True
        cap = _to_int(user_data.get("bankCap"))
        if cap is not None:
            out["bankCap"] = max(0, cap)
    return out


def _points_from(data: Any) -> List[Dict[str, Any]]:
    """Markers the AI placed on the screenshot: up to 8 in a fight (5 otherwise) {x, y, label, where?, note?, missable?,
    rank?}, x/y as 0-1 fractions. rank is a fight's kill order (1 = first) for its top 2-3 targets."""
    out: List[Dict[str, Any]] = []
    for p in (data.get("points") if isinstance(data, dict) else None) or []:
        try:
            x, y = float(p.get("x")), float(p.get("y"))
        except (TypeError, ValueError, AttributeError):
            continue
        label = str(p.get("label") or "").strip()[:40]
        if 0 <= x <= 1 and 0 <= y <= 1 and label:
            point: Dict[str, Any] = {"x": x, "y": y, "label": label}
            where = str(p.get("where") or "").strip()[:100]
            note = str(p.get("note") or "").strip()[:140]
            if where:
                point["where"] = where
            if note:
                point["note"] = note
            if p.get("missable") is True:
                point["missable"] = True
            # What kind of thing it is (item, character, door...): the marker check looks for people more strictly.
            category = str(p.get("category") or "").strip()
            if re.fullmatch(r"[a-z]{2,12}", category):
                point["category"] = category
            rank = _to_int(p.get("rank"))
            if rank and 1 <= rank <= 3:
                point["rank"] = rank
            # A guide entry the answer found on screen (guide-backed marker): ticking it ticks the guide entry.
            gid, gkey, gslug = (str(p.get(k) or "").strip() for k in ("guideId", "guideKey", "guideSlug"))
            if gid and gkey and gslug and len(gid) <= 120 and len(gkey) <= 120 and len(gslug) <= 160:
                point.update(guideId=gid, guideKey=gkey, guideSlug=gslug)
            out.append(point)
    return out[:8 if isinstance(data, dict) and data.get("combat") is True else 5]


STEP_KINDS = ("step", "choice", "warning")


def _version_tuple(v: Any) -> Tuple[int, ...]:
    """'0.14.0' -> (0, 14, 0); anything else -> () (so it never counts as newer)."""
    m = re.match(r"^(\d+)\.(\d+)(?:\.(\d+))?", str(v or "").strip())
    return tuple(int(x or 0) for x in m.groups()) if m else ()


def _steps_from(data: Any) -> List[Dict[str, Any]]:
    """The answer's quest-log takeaways: up to 4 {kind: step|choice|warning, text, label?, where?, detail?}, most
    important first. label is the short objective (2-6 words) and where one line saying where or how, as the desktop
    app shows them; text and detail are the longer wording, kept for answers without them.
    In a fight they're the battle plan (this turn's action, kill order, key tactic)."""
    out: List[Dict[str, Any]] = []
    for st in (data.get("steps") if isinstance(data, dict) else None) or []:
        if not isinstance(st, dict):
            continue
        text = str(st.get("text") or "").strip()[:200]
        if not text:
            continue
        step: Dict[str, Any] = {"kind": st.get("kind") if st.get("kind") in STEP_KINDS else "step", "text": text}
        label = str(st.get("label") or "").strip()[:60]
        if label:
            step["label"] = label
        where = str(st.get("where") or "").strip()[:120]
        if where:
            step["where"] = where
        detail = str(st.get("detail") or "").strip()[:400]
        if detail:
            step["detail"] = detail
        out.append(step)
    return out[:4]


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_IEND_TRAILER = b"\x00\x00\x00\x00IEND\xaeB`\x82"


def _png_is_complete(path: str) -> bool:
    """A finished PNG starts with the PNG signature and ends with the IEND chunk."""
    try:
        with open(path, "rb") as f:
            if f.read(8) != PNG_SIGNATURE:
                return False
            f.seek(-len(PNG_IEND_TRAILER), os.SEEK_END)
            return f.read() == PNG_IEND_TRAILER
    except OSError:
        return False


async def _wait_for_screenshot(path: str, budget_s: float) -> int:
    """gamescope writes the PNG asynchronously and non-atomically after `gamescopectl` returns.

    Wait until the file's size has been unchanged across two consecutive checks AND it ends with the
    PNG IEND marker (so a write that merely pauses is never mistaken for finished).
    Returns the final size, or 0 if it never completed.
    """
    deadline = time.monotonic() + budget_s
    last, stable = -1, 0
    while time.monotonic() < deadline:
        await asyncio.sleep(0.1)
        try:
            size = os.path.getsize(path)
        except OSError:
            continue
        if size > 0 and size == last:
            stable += 1
            if stable >= 2 and _png_is_complete(path):
                return size
        else:
            stable = 0
        last = size
    return 0


def _remove_quietly(*paths: str) -> None:
    for p in paths:
        try:
            os.remove(p)
        except OSError:
            pass


def _read_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


# ---------------------------------------------------------------------------------------------
# Plugin
# ---------------------------------------------------------------------------------------------


async def _read_limited(resp, limit: int) -> bytes:
    """Read a response body up to `limit` bytes. (content.read(n) returns only what has arrived so far.)"""
    chunks: List[bytes] = []
    total = 0
    async for chunk in resp.content.iter_chunked(65536):
        chunks.append(chunk)
        total += len(chunk)
        if total >= limit:
            break
    return b"".join(chunks)[:limit]

# ---------------------------------------------------------------------------------------------
# What's running beyond Steam's own games (owner, Oct 30 2026): a non-Steam shortcut's emulator and the game it loaded
# ---------------------------------------------------------------------------------------------
# Steam says what's running (the frontend reads it); for a non-Steam shortcut that's often an emulator (EmuDeck,
# RetroArch, a standalone emulator) or a frontend that started one (ES-DE). The emulator's game comes from the file it
# was started with (its command line), else RetroArch's content history; with neither name, "Which game is this?" once,
# remembered for that file. Only the game's name and a hashed key leave this file: never paths or file names.
# Emulated, modded and unofficial copies are games like any other. Same rules as the desktop app's
# electron/gameDetect.cjs.

# (id, name, process name). Process names come from the program's file (/proc/<pid>/exe) and its first argument (an
# AppImage's, or a Windows emulator's under Proton), without .exe / .AppImage, lowercased.
EMULATORS: Tuple[Tuple[str, str, str], ...] = (
    ("retroarch", "RetroArch", r"^retroarch$"),
    ("dolphin", "Dolphin", r"^(dolphin-emu(-nogui)?|dolphin|primehack)$"),
    ("ryujinx", "Ryujinx", r"^ryujinx(\.ava)?$"),
    ("yuzu", "yuzu", r"^(yuzu|suyu|sudachi|citron|torzu|eden)(-cmd)?$"),
    ("pcsx2", "PCSX2", r"^pcsx2(-qt)?([\w.-]*)$"),
    ("rpcs3", "RPCS3", r"^rpcs3$"),
    ("cemu", "Cemu", r"^cemu$"),
    ("duckstation", "DuckStation", r"^duckstation(-qt|-nogui)?([\w.-]*)$"),
    ("ppsspp", "PPSSPP", r"^ppsspp(sdl|qt)?$"),
    ("xemu", "xemu", r"^xemu$"),
    ("xenia", "Xenia", r"^xenia(_canary)?$"),
    ("citra", "Citra", r"^(citra(-qt)?|lime3ds(-gui)?|azahar|mandarine)$"),
    ("melonds", "melonDS", r"^melonds$"),
    ("mgba", "mGBA", r"^mgba(-qt)?$"),
    ("flycast", "Flycast", r"^flycast$"),
    ("vita3k", "Vita3K", r"^vita3k$"),
    ("shadps4", "shadPS4", r"^shadps4$"),
    ("ares", "ares", r"^ares$"),
    ("mame", "MAME", r"^mame$"),
    ("scummvm", "ScummVM", r"^scummvm$"),
    ("dosbox", "DOSBox", r"^dosbox(-x|-staging)?$"),
    ("snes9x", "Snes9x", r"^snes9x(-gtk)?$"),
    ("mednafen", "Mednafen", r"^mednafen$"),
    ("bsnes", "bsnes", r"^bsnes$"),
    ("mesen", "Mesen", r"^mesen$"),
)
_EMU_RES = tuple((i, n, re.compile(p, re.I)) for i, n, p in EMULATORS)
# Not a game's file: programs, cores, settings, logs.
_NOT_ROM = re.compile(r"\.(exe|dll|so|dylib|cfg|ini|json|xml|txt|log|bat|cmd|sh|lnk|toml|yml|yaml|appimage)$", re.I)
# Options followed by a value that isn't the game (RetroArch's core and config, a config/user folder elsewhere).
_VALUE_OPTS = re.compile(r"^(-L|--libretro|-c|--config|--appendconfig|-u|--user|--set|--subsystem|-f?b|--batch-config|--userdir|--config-dir)$", re.I)
_GENERIC_FILE = re.compile(r"^(eboot|default|game|rom|main|boot|index|disc\s*\d*|disk\s*\d*|image|track\s*\d*|data|content|code|menu|app|launch|start|update)$", re.I)
_TITLE_ID = re.compile(r"^(?:[A-Z]{4}[-_]?\d{5}|[0-9A-F]{16}|[0-9a-f]{8}-[0-9a-f]{8}|title\s*id.*)$", re.I)
# Files that never say the game, in folders that always do (a PS3 game's EBOOT.BIN, a Wii U game's .rpx, an Xbox
# game's default.xex); any other file with no name in it is asked about.
_FOLDER_GAME_FILE = re.compile(r"(^(eboot|default|main|boot)\.(bin|xex|elf|self)$)|\.rpx$", re.I)
_GAME_SUBDIR = re.compile(r"^(ps3_game|usrdir|code|content|meta|host|sce_sys|app)$", re.I)


def _loose(s: Any) -> str:
    return re.sub(r"[\W_]+", "", str(s or "").lower())


def clean_title(s: Any) -> str:
    """A file or window name as a game name: bracketed codes, regions, versions and "Disc 1" gone."""
    s = str(s or "")
    s = re.sub(r"\[[^\]]*\]", " ", s)
    s = re.sub(r"\((?:[^()]*\b(?:usa|europe|japan|world|en|fr|de|es|it|rev|disc|disk|beta|demo|proto|v\d)[^()]*|[A-Z0-9-]{4,}|\d+-bit)\)", " ", s, flags=re.I)
    s = re.sub(r"\bv\d+(?:\.\d+)+[\w-]*|\b\d+\.\d+\.\d+[\w-]*", " ", s, flags=re.I)
    s = re.sub(r"\s{2,}", " ", s)
    return re.sub(r"^[\s:·|–—-]+|[\s:·|–—-]+$", "", s).strip()


def rom_from_args(args: List[str]) -> Optional[str]:
    """The file an emulator was started with: its last argument that's a file (an extension with a letter in it), not
    an option or an option's value."""
    found = None
    i = 0
    while i < len(args):
        a = args[i]
        i += 1
        if _VALUE_OPTS.match(a):
            i += 1
            continue
        m = re.match(r"^--?([\w-]+)=(.*)$", a)
        if m:
            v = m.group(2)
            if m.group(1).lower() in ("rom", "game", "disc", "iso", "boot", "file", "path") and re.search(r"\.[a-z0-9]{0,4}[a-z][a-z0-9]{0,4}$", v, re.I) and not _NOT_ROM.search(v):
                found = v
            continue
        if a.startswith("-"):
            continue
        ext = re.search(r"\.([a-z0-9]{1,5})$", a, re.I)
        if ext and re.search(r"[a-z]", ext.group(1), re.I) and not _NOT_ROM.search(a):
            found = a
    return found


def name_from_file(base: Any) -> Optional[str]:
    """A game's name from a file name (no extension, codes, regions, versions), or None when it doesn't say one."""
    stem = re.sub(r"\.[\w]{1,5}$", "", str(base or "")).replace("_", " ")
    stem = re.sub(r"^\s*[A-Z]{4}[-_]?\d{5}\s*[-–]\s*", "", stem)
    stem = re.sub(r"\s*[-–]\s*[A-Z]{4}[-_]?\d{5}\s*$", "", stem)
    name = clean_title(stem)
    if len(name) < 2 or not re.search(r"[^\W\d_]{2,}", name) or _GENERIC_FILE.match(name) or _TITLE_ID.match(name):
        return None
    return name


def name_from_path(path: Any) -> Optional[str]:
    """The game from a loaded file's path: its name, or (for EBOOT.BIN, .rpx, default.xex) the game's folder."""
    parts = [p for p in re.split(r"[\\/]+", str(path or "")) if p]
    base = parts[-1] if parts else ""
    if not _FOLDER_GAME_FILE.search(base):
        return name_from_file(base)
    for i in range(len(parts) - 2, max(-1, len(parts) - 5), -1):
        if _GAME_SUBDIR.match(parts[i]):
            continue
        m = re.match(r"^[A-Z]{4}\d{5}-?\[(.*)\]$", parts[i])
        return name_from_file(m.group(1) if m else parts[i])
    return None


def hash_key(raw: str) -> str:
    """A key as it leaves here: hashed (the program's and file's names stay on the Deck)."""
    import hashlib
    return "k" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def last_history_item(text: str) -> Optional[Dict[str, Optional[str]]]:
    """RetroArch's most recent content (content_history.lpl, JSON): {path, label}, or None."""
    try:
        it = (json.loads(text).get("items") or [None])[0]
    except (ValueError, AttributeError):
        return None
    if not it or not it.get("path"):
        return None
    label = it.get("label")
    return {"path": str(it["path"]).split("#")[0], "label": str(label) if label and label != "N/A" else None}


def emulator_of(names: List[str]) -> Optional[Tuple[str, str]]:
    """(id, name) of the emulator a process is, from its program names, or None."""
    for raw in names:
        n = re.sub(r"\.(exe|appimage|x86_64)$", "", os.path.basename(str(raw or "").replace("\\", "/")), flags=re.I).lower()
        for i, name, rx in _EMU_RES:
            if n and rx.match(n):
                return i, name
    return None


def find_emulator_game(proc_root: str = "/proc", home: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """The newest emulator process and its game: {emulator, name, key, fromFile}, or None (no emulator running, or one
    in its menus with nothing loaded). key: hashed, the file's when there is one."""
    best = None
    try:
        pids = [p for p in os.listdir(proc_root) if p.isdigit()]
    except OSError:
        return None
    for pid in pids:
        base = os.path.join(proc_root, pid)
        try:
            with open(os.path.join(base, "cmdline"), "rb") as f:
                args = [a.decode("utf-8", "replace") for a in f.read().split(b"\0") if a]
        except OSError:
            continue
        if not args:
            continue
        try:
            exe = os.readlink(os.path.join(base, "exe"))
        except OSError:
            exe = ""
        emu = emulator_of([exe, args[0]] + ([args[1]] if len(args) > 1 and re.search(r"(?i)(wine|proton)", args[0]) else []))
        if not emu:
            continue
        try:
            started = os.stat(base).st_ctime
        except OSError:
            started = 0
        if not best or started > best[0]:
            best = (started, emu, args)
    if not best:
        return None
    started, (emu_id, emu_name), args = best
    rom = rom_from_args(args[1:])
    label = None
    if not rom and emu_id == "retroarch":
        for rel in (".config/retroarch", ".var/app/org.libretro.RetroArch/config/retroarch"):
            f = os.path.join(home or os.path.expanduser("~"), rel, "playlists", "builtin", "content_history.lpl")
            try:
                if os.stat(f).st_mtime < started - 2:
                    continue
                with open(f, "r", encoding="utf-8") as fh:
                    it = last_history_item(fh.read())
            except OSError:
                continue
            if it:
                rom, label = it["path"], it["label"]
                break
    if not rom:
        return None  # in its own menus: nothing loaded yet
    file_base = [p for p in re.split(r"[\\/]+", rom) if p][-1]
    name = (label and name_from_file(label)) or name_from_path(rom)
    return {"emulator": emu_name, "name": name, "key": hash_key(f"{emu_id}|f:{_loose(file_base)}"), "fromFile": True}


LEARNED_MAX = 300


class Plugin:
    # ---- lifecycle ---------------------------------------------------------------------------

    async def _main(self):
        self.state: Dict[str, Any] = _read_json(SETTINGS_PATH)
        self.state.setdefault("settings", {})
        for key, value in DEFAULT_SETTINGS.items():
            self.state["settings"].setdefault(key, value)
        if not self.state.get("guest_id"):
            self.state["guest_id"] = "guest_deck_" + secrets.token_hex(12)
        # A random id for this Deck (sent as x-qc-device): free accounts on one device share one day of free questions.
        if not self.state.get("device_id"):
            self.state["device_id"] = "deck_" + secrets.token_hex(16)
        self.state.setdefault("auth", None)
        self.state.setdefault("relink_needed", False)
        self.pending_link: Optional[Dict[str, Any]] = None
        self._ask_lock = asyncio.Lock()
        self._ssl, ca_source = _make_ssl_context()
        self._save()
        decky.logger.info(f"Quest Compendium backend ready (CA bundle: {ca_source})")

    async def _unload(self):
        decky.logger.info("Quest Compendium unloading")

    async def _uninstall(self):
        decky.logger.info("Quest Compendium uninstalled")

    # ---- persistence -------------------------------------------------------------------------

    def _save(self) -> None:
        try:
            _write_json_private(SETTINGS_PATH, self.state)
        except OSError as e:
            decky.logger.error(f"Could not save settings: {e}")

    def _api_base(self) -> str:
        override = str(self.state["settings"].get("api_base") or "").strip().rstrip("/")
        return override or DEFAULT_API_BASE

    # ---- HTTP --------------------------------------------------------------------------------

    async def _http(
        self,
        method: str,
        path: str,
        *,
        body: Optional[Dict[str, Any]] = None,
        token: Optional[str] = None,
        timeout_s: float = SHORT_TIMEOUT_S,
    ) -> Tuple[int, Dict[str, Any]]:
        """Returns (status, json). Status 0 means the request never got a response."""
        headers = {"User-Agent": f"QuestCompendiumDeck/{decky.DECKY_PLUGIN_VERSION}"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        # The Deck's time zone (from the panel), so the day's questions reset at local midnight.
        if getattr(self, "_tz", ""):
            headers["x-qc-tz"] = self._tz
        if getattr(self, "state", None) and self.state.get("device_id"):
            headers["x-qc-device"] = self.state["device_id"]
        try:
            timeout = aiohttp.ClientTimeout(total=timeout_s)
            connector = aiohttp.TCPConnector(ssl=self._ssl)
            async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                async with session.request(
                    method, f"{self._api_base()}{path}", json=body, headers=headers
                ) as resp:
                    try:
                        data = await resp.json(content_type=None)
                    except Exception:
                        # Non-JSON body (e.g. an HTML error page). Never surface raw markup in the UI.
                        data = {"error": f"Unexpected response from the server (HTTP {resp.status})."}
                    if not isinstance(data, dict):
                        data = {"error": "Unexpected response from server"}
                    return resp.status, data
        except asyncio.TimeoutError:
            return 0, {"error": "The server took too long to respond."}
        except aiohttp.ClientConnectorCertificateError as e:
            decky.logger.warning(f"Network error on {path}: {type(e).__name__}: {str(e)[:200]}")
            return 0, {"error": "Couldn't verify the server's security certificate (TLS). Details are in the plugin log."}
        except aiohttp.ClientError as e:
            decky.logger.warning(f"Network error on {path}: {type(e).__name__}: {str(e)[:200]}")
            return 0, {"error": f"Can't reach the Quest Compendium server ({type(e).__name__}). Check your connection."}

    # ---- auth --------------------------------------------------------------------------------

    async def _bearer(self, force_refresh: bool = False) -> Tuple[Optional[str], bool, Optional[str]]:
        """Returns (token, is_guest, notice). token is None only if we cannot authenticate at all."""
        auth = self.state.get("auth")
        if not auth:
            return self.state["guest_id"], True, None

        now = time.time()
        if force_refresh or now >= auth.get("expiresAt", 0) - TOKEN_REFRESH_MARGIN_S:
            status, data = await self._http(
                "POST", "/api/device/refresh", body={"refreshToken": auth["refreshToken"]}
            )
            if status == 200 and data.get("idToken"):
                auth["idToken"] = data["idToken"]
                auth["refreshToken"] = data.get("refreshToken") or auth["refreshToken"]
                auth["expiresAt"] = now + (_to_int(data.get("expiresIn")) or 3600)
                self._save()
            elif status in (400, 401, 403):
                # Refresh token was revoked or expired. Fall back to guest and tell the UI.
                decky.logger.info("Linked account expired; falling back to guest mode")
                self.state["auth"] = None
                self.state["relink_needed"] = True
                self._save()
                return (
                    self.state["guest_id"],
                    True,
                    "Your linked account expired, so you're in guest mode. Link again to restore Premium.",
                )
            elif now >= auth.get("expiresAt", 0):
                return None, False, data.get("error") or "Can't reach the Quest Compendium server."
            # else: transient failure but the current token is still valid; keep using it.
        return auth["idToken"], False, None

    # ---- screenshot --------------------------------------------------------------------------

    async def _capture(self) -> Dict[str, Any]:
        """Capture the game frame. Uses gamescope's default screenshot type, which is
        BASE_PLANE_ONLY ("just the game"), so the Quick Access Menu is NOT in the picture."""
        env = _clean_env()
        gamescopectl = _which("gamescopectl", env)
        if not gamescopectl:
            return {"ok": False, "error": "gamescopectl not found. Screenshots need Gaming Mode on a recent SteamOS."}

        started = time.monotonic()
        stem = f"/tmp/qc-{secrets.token_hex(6)}"
        raw, jpg = f"{stem}.png", f"{stem}.jpg"
        try:
            proc = await asyncio.create_subprocess_exec(
                gamescopectl, "screenshot", raw, stdout=DEVNULL, stderr=PIPE, env=env
            )
            try:
                _, err = await asyncio.wait_for(proc.communicate(), timeout=8)
            except asyncio.TimeoutError:
                proc.kill()
                return {"ok": False, "error": "gamescopectl timed out."}
            if proc.returncode:
                detail = (err or b"").decode(errors="replace").strip()[:160]
                return {"ok": False, "error": f"gamescopectl failed: {detail or proc.returncode}"}

            if not await _wait_for_screenshot(raw, 8.0):
                return {"ok": False, "error": "gamescope didn't produce a screenshot. Are you in Gaming Mode?"}

            data: Optional[bytes] = None
            mime = "image/png"
            ffmpeg = _which("ffmpeg", env)
            if ffmpeg:
                ff = await asyncio.create_subprocess_exec(
                    ffmpeg, "-y", "-loglevel", "error", "-i", raw,
                    "-vf", f"scale='min({SCREENSHOT_MAX_WIDTH},iw)':-2",
                    "-q:v", "4", "-f", "image2", jpg,
                    stdout=DEVNULL, stderr=DEVNULL, env=env,
                )
                try:
                    await asyncio.wait_for(ff.wait(), timeout=15)
                except asyncio.TimeoutError:
                    ff.kill()
                if ff.returncode == 0 and os.path.exists(jpg):
                    data, mime = await asyncio.to_thread(_read_bytes, jpg), "image/jpeg"
            if data is None:
                data = await asyncio.to_thread(_read_bytes, raw)

            if len(data) > MAX_IMAGE_BYTES:
                return {"ok": False, "error": "Screenshot is too large to send (ffmpeg is needed to shrink it)."}
            return {
                "ok": True,
                "mime": mime,
                "b64": base64.b64encode(data).decode("ascii"),
                "bytes": len(data),
                "ms": int((time.monotonic() - started) * 1000),
            }
        except Exception as e:  # never let a capture problem crash the request
            decky.logger.error(f"Screenshot error: {type(e).__name__}: {e}")
            return {"ok": False, "error": "Screenshot failed unexpectedly."}
        finally:
            _remove_quietly(raw, jpg)

    # ---- callable from the frontend ----------------------------------------------------------

    async def check_update(self, force: bool = False) -> Dict[str, Any]:
        """Is there a newer release than this one? {ok, current, latest, newer, installUrl}. Cached for a few hours
        (force: Settings' "Check for updates" asks GitHub now); offline or any problem: {ok: False}, and the panel shows
        nothing. Every outcome is logged at warning level with the installed version, so a missing prompt can be told
        apart from "already up to date" in ~/homebrew/logs."""
        now = time.time()
        cached = getattr(self, "_update_cache", None)
        if cached and now < cached[0] and not force:
            return cached[1]
        current = str(decky.DECKY_PLUGIN_VERSION or "")
        result: Dict[str, Any] = {"ok": False, "current": current}
        why = ""
        try:
            timeout = aiohttp.ClientTimeout(total=10)
            connector = aiohttp.TCPConnector(ssl=self._ssl)
            headers = {"Accept": "application/vnd.github+json", "User-Agent": f"QuestCompendiumDeck/{current or 'unknown'}"}
            async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                async with session.get(RELEASES_API, headers=headers) as resp:
                    data = await resp.json(content_type=None) if resp.status == 200 else None
                    if resp.status != 200:
                        why = f"GitHub answered {resp.status}" + (" (rate limited)" if resp.status in (403, 429) else "")
            tag = str((data or {}).get("tag_name") or "").strip()
            latest = tag[1:] if tag[:1] in ("v", "V") else tag
            if _version_tuple(latest):
                # An installed version Decky didn't report (or an odd one) can't be compared: say so in the log, and
                # offer the latest anyway rather than staying silent.
                known = bool(_version_tuple(current))
                result = {
                    "ok": True,
                    "current": current,
                    "latest": latest,
                    "newer": (not known) or _version_tuple(latest) > _version_tuple(current),
                    "installUrl": INSTALL_URL,
                }
                if not known:
                    why = f"installed version unknown ({current!r})"
            elif not why:
                why = f"no version in the reply (tag {tag!r})"
        except Exception as e:  # offline, certificate, unexpected reply: say nothing to the player
            why = f"{type(e).__name__}: {str(e)[:120]}"
        if result["ok"]:
            decky.logger.warning(f"Update check: installed {current or '?'}, latest {result['latest']}, newer {result['newer']}{f' ({why})' if why else ''}{' [forced]' if force else ''}")
        else:
            decky.logger.warning(f"Update check failed: installed {current or '?'}: {why or 'unknown'}{' [forced]' if force else ''}")
        self._update_cache = (now + (UPDATE_CHECK_S if result["ok"] else UPDATE_RETRY_S), result)
        return result

    async def get_state(self) -> Dict[str, Any]:
        env = _clean_env()
        auth = self.state.get("auth")
        return {
            "linked": bool(auth),
            "email": (auth or {}).get("email"),
            "relinkNeeded": bool(self.state.get("relink_needed")),
            "settings": {
                "mode": _mode(self.state["settings"]["mode"]),
                "model": self.state["settings"]["model"],
                "include_screenshot": bool(self.state["settings"]["include_screenshot"]),
                "auto_switch": bool(self.state["settings"].get("auto_switch", True)),
                "recap": bool(self.state["settings"].get("recap", True)),
            },
            "tools": {
                "gamescopectl": bool(_which("gamescopectl", env)),
                # Hold to talk records from the microphone with one of these.
                "recorder": bool(_which("pw-record", env) or _which("arecord", env)),
                "ffmpeg": bool(_which("ffmpeg", env)),
            },
            "version": decky.DECKY_PLUGIN_VERSION,
        }

    async def save_settings(self, patch: Dict[str, Any]) -> bool:
        s = self.state["settings"]
        if patch.get("mode") in VALID_MODES:
            s["mode"] = patch["mode"]
        if patch.get("model") in VALID_MODELS:
            s["model"] = patch["model"]
        if isinstance(patch.get("include_screenshot"), bool):
            s["include_screenshot"] = patch["include_screenshot"]
        if isinstance(patch.get("auto_switch"), bool):
            s["auto_switch"] = patch["auto_switch"]
        if isinstance(patch.get("recap"), bool):
            s["recap"] = patch["recap"]
        if patch.get("locale") in VALID_LOCALES:
            s["locale"] = patch["locale"]
        if isinstance(patch.get("guide_sites"), list):
            sites = []
            for d in patch["guide_sites"][:MAX_GUIDE_SITES]:
                d = str(d or "").strip().lower()
                d = re.sub(r"^https?://", "", d).split("/")[0]
                if d.startswith("www."):
                    d = d[4:]
                if DOMAIN_RE.match(d) and d not in sites:
                    sites.append(d)
            s["guide_sites"] = sites
        self._save()
        return True

    def _remember_tz(self, tz: Any) -> None:
        tz = str(tz or "").strip()
        if tz and len(tz) <= 64 and all(c.isalnum() or c in "/_+-" for c in tz):
            self._tz = tz

    async def get_quota(self, tz: str = "") -> Dict[str, Any]:
        self._remember_tz(tz)
        token, _, notice = await self._bearer()
        if token is None:
            return {"ok": False, "error": notice}
        status, data = await self._http("GET", "/api/user/status", token=token)
        if status == 200:
            data.setdefault("isGuest", self.state.get("auth") is None)
            return {"ok": True, "quota": _quota_from(data), "notice": notice}
        return {"ok": False, "error": data.get("error") or f"Server error ({status})"}

    async def get_offers(self) -> Dict[str, Any]:
        """Today's Premium offers for this player (the server's /api/offers): the monthly free trial if they can still
        have one, and the holiday deal on yearly. Empty when the server can't say."""
        token, _, _notice = await self._bearer()
        if token is None:
            return {"ok": False, "trial": None, "holiday": None}
        status, data = await self._http("GET", "/api/offers", token=token)
        if status == 200 and isinstance(data, dict):
            trial = data.get("trial") if isinstance(data.get("trial"), dict) else None
            holiday = data.get("holiday") if isinstance(data.get("holiday"), dict) else None
            return {"ok": True, "trial": {"days": _to_int(trial.get("days")) or 7} if trial else None,
                    "holiday": {"line": str(holiday.get("line") or "")} if holiday else None}
        return {"ok": False, "trial": None, "holiday": None}

    async def emulator_game(self) -> Dict[str, Any]:
        """The emulator running now and its game, for a non-Steam shortcut: {emulator, name, key, ask} (ask: no name yet,
        "Which game is this?"; notGame: the player said it isn't one), or {} when none is."""
        home = None
        try:
            home = getattr(decky, "DECKY_USER_HOME", None) or pwd.getpwnam(decky.DECKY_USER).pw_dir
        except (KeyError, AttributeError, TypeError):
            pass
        found = await asyncio.get_running_loop().run_in_executor(None, find_emulator_game, "/proc", home)
        if not found:
            return {}
        said = (self.state.get("learned_games") or {}).get(found["key"])
        if said is not None:
            return {**found, "name": said or None, "ask": False, "notGame": not said, "learned": True}
        return {**found, "ask": not found["name"]}

    async def learn_game(self, key: str, name: Optional[str]) -> bool:
        """The player's answer to "Which game is this?" for a file (a hashed key), remembered on this Deck; "" = not a
        game. The newest answers are kept."""
        key = str(key or "")
        if not re.match(r"^k[0-9a-f]{24}$", key):
            return False
        learned = dict(self.state.get("learned_games") or {})
        learned.pop(key, None)
        learned[key] = str(name or "").strip()[:120]
        for k in list(learned)[: max(0, len(learned) - LEARNED_MAX)]:
            del learned[k]
        self.state["learned_games"] = learned
        self._save()
        return True

    async def test_screenshot(self) -> Dict[str, Any]:
        """Diagnostic: capture but don't send. Returns size/timing, never the image."""
        shot = await self._capture()
        if shot["ok"]:
            return {"ok": True, "bytes": shot["bytes"], "mime": shot["mime"], "ms": shot["ms"]}
        return {"ok": False, "error": shot["error"]}

    async def check_markers(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """The precision pass, as on the desktop: close-ups of each marked spot (cropped by the panel) go to /api/refine,
        which says which marked things it can actually see and exactly where. ok False: the check couldn't run (offline,
        not allowed, busy), so the panel keeps every marker as it was."""
        crops = []
        for c in (req.get("crops") if isinstance(req, dict) else None) or []:
            if not isinstance(c, dict):
                continue
            image = str(c.get("image") or "")
            label = str(c.get("label") or "").strip()[:40]
            if label and image.startswith("data:image/jpeg;base64,") and len(image) <= MAX_CROP_CHARS:
                crop = {"image": image, "label": label}
                where = str(c.get("where") or "").strip()[:100]
                if where:
                    crop["where"] = where
                category = str(c.get("category") or "").strip()
                if re.fullmatch(r"[a-z]{2,12}", category):
                    crop["category"] = category
                if c.get("guide") is True:
                    crop["guide"] = True
                crops.append(crop)
        crops = crops[:MAX_CHECK_CROPS]
        if not crops:
            return {"ok": False}
        token, _is_guest, _notice = await self._bearer()
        if token is None:
            return {"ok": False}
        game = str(req.get("game") or "").strip()[:120]
        # The app and version go along: any markers the check removes are noted with them (the owner's Quality page).
        body = {"crops": crops, "game": game, "client": "deck", "appVersion": str(decky.DECKY_PLUGIN_VERSION)[:24]}
        status, data = await self._http("POST", "/api/refine", body=body, token=token, timeout_s=SHORT_TIMEOUT_S)
        if status != 200 or not isinstance(data.get("found"), list):
            return {"ok": False}
        found = []
        for f in data["found"]:
            try:
                i, x, y = int(f.get("index")), float(f.get("x")), float(f.get("y"))
            except (TypeError, ValueError, AttributeError):
                continue
            if 0 <= i < len(crops) and 0 <= x <= 1 and 0 <= y <= 1:
                found.append({"index": i, "x": x, "y": y})
        checked = _to_int(data.get("checked"))
        # Older servers checked the first 5 and didn't say so.
        checked = min(len(crops), checked if checked is not None else 5)
        return {"ok": True, "found": found, "checked": checked}

    async def visual(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """Visual answers (owner, Nov 14 2026): the video or picture for an answer that has arrived, from the server's
        /api/visual (the answer itself never waits for it). {ok, visual, ref}; visual is None when nothing helps."""
        question = str(req.get("question") or "").strip()[:MAX_QUESTION_CHARS]
        answer = str(req.get("answer") or "").strip()[:6000]
        game = str(req.get("game") or "").strip()[:120]
        if not question or not answer or not game:
            return {"ok": True, "visual": None}
        token, _is_guest, _notice = await self._bearer()
        if token is None:
            return {"ok": False, "visual": None}
        status, data = await self._http(
            "POST", "/api/visual",
            # shotOnly: a voice question (its text is the stand-in "Voice message"): the topic comes from the answer.
            body={"game": game, "question": question, "answer": answer, "client": "deck",
                  "appVersion": str(decky.DECKY_PLUGIN_VERSION)[:24], **({"shotOnly": True} if req.get("shotOnly") is True else {})},
            token=token, timeout_s=60,
        )
        if status != 200 or not isinstance(data, dict):
            return {"ok": False, "visual": None}
        v = data.get("visual")
        if not isinstance(v, dict) or v.get("kind") not in ("video", "picture", "link"):
            return {"ok": True, "visual": None}
        return {"ok": True, "visual": v, "ref": data.get("ref") if isinstance(data.get("ref"), str) else None}

    async def save_recap(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """"Where was I?" (session companion step 1, owner Nov 18 2026): what the player was last doing in a game (the
        latest answer's title, its open steps, the place, the last question), kept in settings.json so it survives a
        restart. At most 20 games, oldest dropped. Nothing goes to the server."""
        key = str(req.get("gameKey") or "").strip()[:120]
        if not key:
            return {"ok": False}
        def s(v: Any, n: int) -> str:
            return re.sub(r"\s+", " ", str(v or "")).strip()[:n]
        rec = {
            "title": s(req.get("title"), 120), "place": s(req.get("place"), 120), "lastAsked": s(req.get("lastAsked"), 160),
            "steps": [s(x, 140) for x in (req.get("steps") or []) if s(x, 140)][:3], "at": int(time.time() * 1000),
        }
        if not rec["title"] and not rec["lastAsked"]:
            return {"ok": False}
        recaps = dict(self.state.get("recaps") or {})
        recaps[key] = rec
        if len(recaps) > 20:
            for k in sorted(recaps, key=lambda k: recaps[k].get("at", 0))[: len(recaps) - 20]:
                recaps.pop(k, None)
        self.state["recaps"] = recaps
        self._save()
        return {"ok": True}

    async def get_recap(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """The recap saved for a game, or None."""
        rec = (self.state.get("recaps") or {}).get(str(req.get("gameKey") or "")[:120])
        return {"ok": True, "recap": rec if isinstance(rec, dict) else None}

    async def drawn(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """Drawn answers (owner, Nov 18 2026): the answer drawn on the question's screenshot (or a wiki picture), or an
        illustration, from the server's /api/drawn, only when seeing it helps (the server decides; most answers get
        none). After the answer, like visual(). {ok, drawn}; drawn is None when there's none."""
        question = str(req.get("question") or "").strip()[:MAX_QUESTION_CHARS]
        answer = str(req.get("answer") or "").strip()[:6000]
        game = str(req.get("game") or "").strip()[:120]
        if not question or not answer or not game:
            return {"ok": True, "drawn": None}
        token, _is_guest, _notice = await self._bearer()
        if token is None:
            return {"ok": False, "drawn": None}
        shot = getattr(self, "_last_shot", None)
        if not shot or time.time() - float(getattr(self, "_last_shot_at", 0) or 0) > 300:
            shot = None
        status, data = await self._http(
            "POST", "/api/drawn",
            body={"game": game, "question": question, "answer": answer, "client": "deck",
                  **({"image": shot} if shot else {}), **({"shotOnly": True} if req.get("shotOnly") is True else {})},
            token=token, timeout_s=90,
        )
        if status != 200 or not isinstance(data, dict):
            return {"ok": False, "drawn": None}
        d = data.get("drawn")
        url = str(d.get("url") or "") if isinstance(d, dict) else ""
        if not isinstance(d, dict) or d.get("kind") != "drawn" or d.get("on") not in ("screen", "wiki", "illustration") \
                or not re.match(r"^data:image/(jpeg|png|webp);base64,", url) or len(url) > 3_000_000:
            return {"ok": True, "drawn": None}
        page = d.get("page") if isinstance(d.get("page"), dict) and str(d["page"].get("url") or "").startswith("https://") else None
        out = {"kind": "drawn", "url": url, "on": d["on"], "alt": str(d.get("alt") or "")[:200]}
        if page:
            out["page"] = {"url": str(page["url"]), "title": str(page.get("title") or "")[:120], "site": str(page.get("site") or "")[:60]}
        return {"ok": True, "drawn": out}

    async def locate(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """Help me here (owner, Nov 15 2026; roadmap item 30): a screenshot of the game, and the server's /api/locate-me
        reads where in the guide the player is and what they're doing. {ok, area, confident, story, doing, error,
        limitReached}. Its own daily allowance, separate from questions."""
        game = str(req.get("game") or "").strip()[:120]
        areas = [
            {"name": str(a.get("name") or "")[:80], "story": str(a.get("story") or "")[:160]}
            for a in (req.get("areas") or []) if isinstance(a, dict) and a.get("name")
        ][:400]
        # Any game (owner, Nov 15 2026): a guide's areas are a list to pick from; without one the server names the area.
        if not game:
            return {"ok": False, "error": "noGame"}
        token, _is_guest, _notice = await self._bearer()
        if token is None:
            return {"ok": False, "error": "signin"}
        shot = await self._capture()
        if not shot.get("ok"):
            return {"ok": False, "error": shot.get("error") or "screenshot"}
        status, data = await self._http(
            "POST", "/api/locate-me",
            body={"imageBase64": f"data:{shot['mime']};base64,{shot['b64']}", "game": game,
                  "guideKey": str(req.get("guideKey") or "")[:120], "areas": areas, "doing": True},
            token=token, timeout_s=60,
        )
        if not isinstance(data, dict):
            return {"ok": False, "error": "server"}
        if status == 429:
            return {"ok": False, "limitReached": True, "error": str(data.get("error") or "")[:300]}
        if status != 200:
            return {"ok": False, "error": str(data.get("error") or "server")[:300]}
        doing = data.get("doing") if isinstance(data.get("doing"), dict) else None
        out = {"ok": True, "area": str(data.get("area") or "unknown"), "confident": data.get("confident") is True,
               "story": str(data.get("story") or ""), "doing": doing}
        worth = self._worth_ticket(data.get("worth"))
        if worth:
            out["worth"] = worth
        return out

    @staticmethod
    def _worth_ticket(w: Any) -> Optional[Dict[str, Any]]:
        """The area's "Worth getting here" status from the server, with a ticket to fill it (worthOnDemand.ts)."""
        if not isinstance(w, dict) or not w.get("slug"):
            return None
        out = {k: str(w.get(k) or "")[:160] for k in ("key", "slug", "name", "status")}
        if isinstance(w.get("ticket"), str) and re.fullmatch(r"[0-9a-f]{8,40}", w["ticket"]):
            out["ticket"] = w["ticket"]
        return out

    def _worth_result(self, data: Any) -> Dict[str, Any]:
        """An area's list for the panel: item cards' pictures get the server's full address."""
        if not isinstance(data, dict):
            return {"ok": False}
        worth = data.get("worth")
        if isinstance(worth, dict):
            base = self._api_base().rstrip("/")
            for g in worth.get("gear") or []:
                card = g.get("card") if isinstance(g, dict) else None
                if isinstance(card, dict) and isinstance(card.get("pic"), str) and card["pic"].startswith("/"):
                    card["pic"] = base + card["pic"]
        return {"ok": True, "status": str(data.get("status") or ""), "key": str(data.get("key") or ""), "slug": str(data.get("slug") or ""),
                "name": str(data.get("name") or ""), "worth": worth, "achievements": data.get("achievements")}

    async def worth_area(self, game: str, place: str) -> Dict[str, Any]:
        """"Worth getting here" for a place, any game, guide or not (the server's GET /api/worth)."""
        q = urlencode({"game": str(game or "")[:120], "place": str(place or "")[:120]})
        status, data = await self._guide_http(f"/api/worth?{q}")
        if status != 200:
            return {"ok": False}
        return self._worth_result(data)

    async def worth_fill(self, ticket: str) -> Dict[str, Any]:
        """Fill an area's list with the ticket Help me here or an answer gave (the server runs it while we wait)."""
        if not re.fullmatch(r"[0-9a-f]{8,40}", str(ticket or "")):
            return {"ok": False}
        token, _is_guest, _notice = await self._bearer()
        if token is None:
            return {"ok": False}
        status, data = await self._http("POST", "/api/worth/fill", body={"ticket": ticket}, token=token, timeout_s=150)
        if status != 200:
            return {"ok": False}
        return self._worth_result(data)

    async def visual_event(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """Played, opened (counted for /stats) or "Not right" (that visual isn't picked for this question again)."""
        kind = req.get("type")
        if kind not in ("played", "opened", "wrong", "drawnWrong"):
            return {"ok": False}
        token, _is_guest, _notice = await self._bearer()
        if token is None:
            return {"ok": False}
        body: Dict[str, Any] = {"type": kind}
        if isinstance(req.get("ref"), str) and re.fullmatch(r"[0-9a-f]{40}", req["ref"]):
            body["ref"] = req["ref"]
        await self._http("POST", "/api/visual/event", body=body, token=token, timeout_s=15)
        return {"ok": True}

    async def ask(self, req: Dict[str, Any]) -> Dict[str, Any]:
        if self._ask_lock.locked():
            return {"ok": False, "error": "Still working on your last question."}
        async with self._ask_lock:
            return await self._ask_locked(req)

    async def _ask_locked(self, req: Dict[str, Any]) -> Dict[str, Any]:
        question = str(req.get("question") or "").strip()[:MAX_QUESTION_CHARS]
        if not question:
            return {"ok": False, "error": "Type a question first."}

        s = self.state["settings"]
        mode = req.get("mode") if req.get("mode") in VALID_MODES else _mode(s["mode"])

        history: List[Dict[str, str]] = []
        for turn in (req.get("history") or [])[-MAX_HISTORY_TURNS:]:
            if isinstance(turn, dict) and turn.get("role") in ("user", "assistant") and turn.get("text"):
                history.append({"role": turn["role"], "text": str(turn["text"])[:MAX_HISTORY_CHARS]})

        payload: Dict[str, Any] = {
            "question": question,
            "history": history,
            "aiMode": mode,
            # The panel resolves the language (including "auto" = Steam's language) and sends it along.
            "language": req.get("language") if req.get("language") in AI_LANGUAGES else (s.get("language") or "English"),
            # Pro or Fast, picked next to Send (when it's used up today, the server answers with the other one).
            "answerModel": "fast" if req.get("answerModel") in ("fast", "flash") else "pro",
        }
        self._remember_tz(req.get("timeZone"))
        if getattr(self, "_tz", ""):
            payload["timeZone"] = self._tz
        # Where the player last was (the latest answer's place, not confirmed), so the server can use that guide page,
        # and the entries ticked there, so an answer can mark the guide's unticked ones it sees.
        place = req.get("place")
        if isinstance(place, dict) and str(place.get("name") or "").strip():
            payload["place"] = {"name": str(place["name"]).strip()[:80], "confirmed": False}
        done = req.get("guideDone")
        if isinstance(done, dict) and str(done.get("slug") or "").strip() and isinstance(done.get("ids"), list):
            payload["guideDone"] = {
                "slug": str(done["slug"]).strip()[:160],
                "ids": [str(i)[:120] for i in done["ids"][:200] if isinstance(i, (str, int))],
            }
        if req.get("quick") in QUICK_IDS:
            payload["quick"] = req["quick"]
        # The quest log's objective (the latest answer's steps not removed, with their indexes), so the answer can say
        # which the question reports done, or the screenshot shows finished (as the desktop app sends it).
        obj = req.get("objective")
        if isinstance(obj, dict) and isinstance(obj.get("steps"), list):
            steps = [
                {"i": s["i"], "text": str(s.get("text") or "").strip()[:140]}
                for s in obj["steps"][:8]
                if isinstance(s, dict) and isinstance(s.get("i"), int) and not isinstance(s.get("i"), bool) and 0 <= s["i"] < 20 and str(s.get("text") or "").strip()
            ]
            if steps:
                payload["objective"] = {"title": str(obj.get("title") or "").strip()[:80], "steps": steps}
        # Hold to talk: the recorded question (stop_recording), sent as audio like the desktop app's voice questions.
        audio = req.get("audio")
        if isinstance(audio, str) and audio.startswith("data:audio/") and len(audio) <= MAX_AUDIO_CHARS:
            payload["audioBase64"] = audio
        game = req.get("game")
        if isinstance(game, dict) and game.get("name"):
            active: Dict[str, Any] = {"name": str(game["name"])[:200]}
            if game.get("appId"):
                active["appId"] = str(game["appId"])
            payload["activeGame"] = active
            payload["isGameRunningLocally"] = True

        screenshot_state, screenshot_error = "off", None
        shot_url: Optional[str] = None
        if req.get("includeScreenshot"):
            shot = await self._capture()
            if shot["ok"]:
                shot_url = f"data:{shot['mime']};base64,{shot['b64']}"
                payload["imageBase64"] = shot_url
                screenshot_state = "attached"
            else:
                screenshot_state, screenshot_error = "failed", shot["error"]
        # Drawn answers (owner, Nov 18 2026): this question's screenshot, kept in memory a few minutes for its drawing
        # (drawn() below); a question without one clears it. Never written to disk.
        self._last_shot = shot_url
        self._last_shot_at = time.time()

        token, is_guest, notice = await self._bearer()
        if token is None:
            return {"ok": False, "error": notice}

        status, data = await self._http("POST", "/api/chat", body=payload, token=token, timeout_s=CHAT_TIMEOUT_S)
        if status == 401 and not is_guest:
            # Token rejected (e.g. clock skew). Refresh once and retry.
            token, is_guest, notice2 = await self._bearer(force_refresh=True)
            notice = notice2 or notice
            if token is not None:
                status, data = await self._http(
                    "POST", "/api/chat", body=payload, token=token, timeout_s=CHAT_TIMEOUT_S
                )

        result: Dict[str, Any] = {
            "screenshot": screenshot_state,
            "screenshotError": screenshot_error,
            "notice": notice,
        }
        if status == 200 and data.get("text"):
            result.update(
                ok=True,
                text=data["text"],
                modelUsed=data.get("modelUsed"),
                quota=_quota_from(data.get("userData")),
            )
            # A guest's last question today: the sign-in card shows under this answer.
            if data.get("signInNudge") is True:
                result["signInNudge"] = True
            # Which model answered; switched = the picked one was used up and the other answered.
            if data.get("answeredWith") in ("pro", "fast"):
                result["answeredWith"] = data["answeredWith"]
                if data.get("switched") is True:
                    result["switched"] = True
            # Premium past the month's safety cap (server, Nov 21 2026): quick answers until the 1st, and the panel says so.
            if data.get("monthCap") is True:
                result["monthCap"] = True
            # The kind of question (sent back with a thumbs up / down for the answer-quality numbers).
            if str(data.get("qtype") or "") in ("location", "puzzle", "fight", "choice", "missable", "general"):
                result["qtype"] = data["qtype"]
            # Markers on the screenshot: the answer page shows the screenshot with them drawn on.
            points = _points_from(data)
            if points and shot_url:
                result.update(points=points, shot=shot_url)
            # Short quest name for what the player is doing (the quest log's title).
            title = str(data.get("title") or "").strip()[:60]
            if title:
                result["title"] = title
            # The quest log's steps; in a fight they're the battle plan.
            steps = _steps_from(data)
            if steps:
                result["steps"] = steps
            # Steps of the quest log's objective (sent as `objective`): the question said they're done (objectiveDone:
            # moved off), or the screenshot shows them finished (objectiveLooksDone: offered, Nov 20 2026).
            for key in ("objectiveDone", "objectiveLooksDone"):
                idx = data.get(key)
                if isinstance(idx, list):
                    ok_idx = [i for i in idx if isinstance(i, int) and not isinstance(i, bool) and 0 <= i < 20][:8]
                    if ok_idx:
                        result[key] = ok_idx
            if data.get("combat") is True:
                result["combat"] = True
                fight = str(data.get("fight") or "").strip()[:80]
                if fight:
                    result["fight"] = fight
            # Where the server thinks the player is (the guide uses it to offer "where you are"), and the story beat.
            place = data.get("place")
            if isinstance(place, dict) and str(place.get("name") or "").strip():
                result["place"] = {"name": str(place.get("name")).strip()[:80]}
                story = str(place.get("story") or "").strip()[:120]
                if story:
                    result["place"]["story"] = story
            # The answer settled the player's area, which has no "Worth getting here" yet: its ticket.
            worth = self._worth_ticket(data.get("worth"))
            if worth:
                result["worth"] = worth
            # Sources under the answer (the pages it read, or wiki pages): https only, short names.
            links = []
            for l in data.get("sourceLinks") or []:
                if isinstance(l, dict) and str(l.get("url") or "").startswith("https://") and l.get("title"):
                    links.append({"url": str(l["url"])[:500], "title": str(l["title"])[:80], "site": str(l.get("site") or "")[:40]})
            if links:
                result["sourceLinks"] = links[:3]
        elif status == 429:
            result.update(ok=True, limitReached=True, text=data.get("text") or "Daily limit reached.")
            # A guest at their limit: the sign-in card (link with your phone) instead of Premium.
            if isinstance(data.get("limit"), dict) and data["limit"].get("isGuest") is True:
                result["signInNudge"] = True
            q = _quota_from(data.get("userData"))
            if q:
                result["quota"] = q
        else:
            result.update(ok=False, error=data.get("error") or f"Server error ({status}).")
        return result

    # ---- account linking (device-code flow) --------------------------------------------------

    async def start_link(self) -> Dict[str, Any]:
        status, data = await self._http("POST", "/api/device/start", body={"client": "decky"})
        if status == 404:
            return {"ok": False, "error": "Account linking isn't available on the server yet. Guest mode still works."}
        if status != 200 or not data.get("deviceCode"):
            return {"ok": False, "error": data.get("error") or f"Couldn't start linking ({status})."}
        expires_in = _to_int(data.get("expiresIn")) or 600
        self.pending_link = {"deviceCode": data["deviceCode"], "expiresAt": time.time() + expires_in}
        return {
            "ok": True,
            "userCode": data.get("userCode"),
            "verificationUrl": data.get("verificationUrl"),
            "expiresIn": expires_in,
            "interval": _to_int(data.get("interval")) or 3,
        }

    async def poll_link(self) -> Dict[str, Any]:
        link = self.pending_link
        if not link:
            return {"status": "none"}
        if time.time() > link["expiresAt"]:
            self.pending_link = None
            return {"status": "expired"}

        status, data = await self._http("POST", "/api/device/poll", body={"deviceCode": link["deviceCode"]})
        if status == 200 and data.get("status") == "linked" and data.get("idToken"):
            self.state["auth"] = {
                "idToken": data["idToken"],
                "refreshToken": data.get("refreshToken", ""),
                "expiresAt": time.time() + (_to_int(data.get("expiresIn")) or 3600),
                "email": data.get("email"),
            }
            self.state["relink_needed"] = False
            self.pending_link = None
            self._save()
            return {"status": "linked", "email": data.get("email")}
        if status == 200 and data.get("status") == "pending":
            return {"status": "pending"}
        if status == 410 or data.get("status") == "expired":
            self.pending_link = None
            return {"status": "expired"}
        if status == 0:
            return {"status": "pending"}  # transient network blip; keep polling
        if status == 404:
            self.pending_link = None
            return {"status": "error", "error": "Account linking isn't available on the server yet."}
        return {"status": "error", "error": data.get("error") or f"Server error ({status})."}

    async def send_email_link(self, email: str, user_code: str, lang: str = "en") -> Dict[str, Any]:
        """Emails a sign-in link for the code on screen: opened on a phone or PC, it asks to confirm the code, and the
        Deck's link check (poll_link) then signs in."""
        status, data = await self._http(
            "POST", "/api/email-link/send", body={"email": str(email or "").strip(), "userCode": str(user_code or ""), "lang": str(lang or "en")}
        )
        if status == 200:
            return {"ok": True}
        return {"ok": False, "error": data.get("error") or f"Server error ({status})."}

    async def cancel_link(self) -> bool:
        self.pending_link = None
        return True

    async def unlink(self) -> bool:
        self.state["auth"] = None
        self.state["relink_needed"] = False
        self.pending_link = None
        self._save()
        return True

    # ---- reader browser ----------------------------------------------------------------------

    async def web_search(self, query: str) -> Dict[str, Any]:
        """Google search through the Quest Compendium server (Gemini + Google Search grounding)."""
        q = str(query or "").strip()[:200]
        if not q:
            return {"ok": False, "error": "Type something to search for."}
        token, is_guest, notice = await self._bearer()
        if token is None:
            return {"ok": False, "error": notice}
        status, data = await self._http("POST", "/api/web-search", body={"q": q}, token=token, timeout_s=35)
        if status == 401 and not is_guest:
            token, is_guest, _ = await self._bearer(force_refresh=True)
            if token is not None:
                status, data = await self._http("POST", "/api/web-search", body={"q": q}, token=token, timeout_s=35)
        if status == 200 and isinstance(data.get("results"), list):
            return {"ok": True, "status": status, "summary": data.get("summary") or "", "results": data["results"]}
        return {"ok": False, "status": status, "error": data.get("error") or f"Search failed (HTTP {status})."}

    # ---- hold to talk (the Deck's microphone, through PipeWire's pw-record, or arecord) ------------------------

    async def start_recording(self, auto: bool = False) -> Dict[str, Any]:
        """Start recording from the default microphone (stopped by stop_recording, or after a minute).

        auto (owner, Nov 20 2026, as the desktop's voice): the recording is watched for the player to stop talking;
        voice_state() then says "end" (send it) or "nothing" (nothing was said in time)."""
        await self._stop_recorder()
        env = _clean_env()
        path = os.path.join(tempfile.gettempdir(), f"qc-voice-{uuid.uuid4().hex}.wav")
        pw = _which("pw-record", env)
        ar = _which("arecord", env)
        if pw:
            cmd = [pw, "--rate", "16000", "--channels", "1", "--format", "s16", path]
        elif ar:
            cmd = [ar, "-q", "-f", "S16_LE", "-r", "16000", "-c", "1", "-d", "60", path]
        else:
            return {"ok": False, "error": "No recorder found (pw-record or arecord)."}
        try:
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=DEVNULL, stderr=PIPE, env=env)
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": f"Could not start the microphone: {e}"}
        rec = {"proc": proc, "path": path, "started": time.time(), "voice": "listen" if auto is True else "manual"}
        self._recorder = rec
        # Never record for more than a minute.
        asyncio.get_event_loop().call_later(60, lambda: asyncio.ensure_future(self._stop_recorder()))
        if auto is True:
            asyncio.ensure_future(self._watch_voice(rec))
        return {"ok": True}

    async def _watch_voice(self, rec: Dict[str, Any]) -> None:
        """Reads the recording as it grows (16 kHz mono s16 WAV) and feeds its loudness, 50 ms at a time, to VoiceEnd.
        Time is counted in samples, so a recorder that writes in bursts only delays the decision."""
        decide = VoiceEnd()
        offset = -1
        samples_seen = 0
        while self._recorder is rec and rec.get("voice") == "listen":
            await asyncio.sleep(0.1)
            try:
                size = os.path.getsize(rec["path"])
                with open(rec["path"], "rb") as f:
                    if offset < 0:
                        head = f.read(512)
                        i = head.find(b"data")
                        if i < 0 or len(head) < i + 8:
                            continue
                        offset = i + 8
                    if size <= offset + 1:
                        continue
                    f.seek(offset)
                    data = f.read(size - offset)
            except OSError:
                continue
            n = len(data) // 2 * 2
            offset += n
            state = voice_chunks(decide, data[:n], samples_seen)
            samples_seen += n // 2
            if state != "listen":
                rec["voice"] = state
                return

    async def voice_state(self) -> Dict[str, Any]:
        """Where an auto recording is: "listen", "end" (the player stopped talking: send it), "nothing" (nothing said in
        time), "manual" (not watched) or "idle" (not recording)."""
        rec = getattr(self, "_recorder", None)
        return {"ok": True, "state": rec.get("voice", "manual") if rec else "idle"}

    async def _stop_recorder(self) -> Optional[str]:
        rec = getattr(self, "_recorder", None)
        self._recorder = None
        if not rec:
            return None
        proc = rec["proc"]
        if proc.returncode is None:
            try:
                proc.send_signal(signal.SIGINT)
                await asyncio.wait_for(proc.wait(), timeout=3)
            except Exception:  # noqa: BLE001
                try:
                    proc.kill()
                except Exception:  # noqa: BLE001
                    pass
        return rec["path"]

    async def stop_recording(self) -> Dict[str, Any]:
        """Stop recording and return it as a data URL (audio/wav), ready for ask() as `audio`."""
        path = await self._stop_recorder()
        if not path:
            return {"ok": False, "error": "Not recording."}
        try:
            with open(path, "rb") as f:
                data = f.read()
        except OSError as e:
            return {"ok": False, "error": f"No recording ({e.strerror})."}
        finally:
            try:
                os.remove(path)
            except OSError:
                pass
        # A WAV header alone (44 bytes) or a fraction of a second: nothing was said.
        if len(data) < 16000:
            return {"ok": False, "error": "Too short: hold the button while you speak."}
        b64 = base64.b64encode(data).decode("ascii")
        if len(b64) > MAX_AUDIO_CHARS:
            return {"ok": False, "error": "Too long: keep voice questions under a minute."}
        return {"ok": True, "audio": f"data:audio/wav;base64,{b64}"}

    async def answer_feedback(self, fb: Dict[str, Any]) -> Dict[str, Any]:
        """A thumbs up / down on an AI answer (or "none" to take it back), for the answer-quality numbers."""
        f = fb if isinstance(fb, dict) else {}
        vote = str(f.get("vote") or "")
        if vote not in ("up", "down", "none"):
            return {"ok": False, "error": "Vote up or down."}
        body = {
            "messageId": str(f.get("messageId") or "")[:80],
            "vote": vote,
            "reason": str(f.get("reason") or "")[:20],
            "qtype": str(f.get("qtype") or "")[:20],
            "model": str(f.get("model") or "")[:80],
            "game": str(f.get("game") or "")[:160],
            "markers": f.get("markers") is True,
            "question": str(f.get("question") or "")[:1000],
            "answer": str(f.get("answer") or "")[:6000],
            "client": "deck",
        }
        # The saved visual the answer showed (the vote raises or lowers it); only its 40-character id.
        if isinstance(f.get("visualRef"), str) and re.fullmatch(r"[0-9a-f]{40}", f["visualRef"]):
            body["visualRef"] = f["visualRef"]
        token, is_guest, notice = await self._bearer()
        if token is None:
            return {"ok": False, "error": notice}
        status, data = await self._http("POST", "/api/answer-feedback", body=body, token=token)
        if status == 401 and not is_guest:
            token, is_guest, _ = await self._bearer(force_refresh=True)
            if token is not None:
                status, data = await self._http("POST", "/api/answer-feedback", body=body, token=token)
        if status == 200 and data.get("ok"):
            return {"ok": True}
        return {"ok": False, "error": data.get("error") or f"Could not send the vote (HTTP {status})."}

    async def report_answer(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """Report an AI answer (offensive or harmful / wrong or misleading / other), saved on the server for review."""
        r = report if isinstance(report, dict) else {}
        reason = str(r.get("reason") or "")
        if reason not in ("harmful", "wrong", "other"):
            return {"ok": False, "error": "Pick a reason."}
        body = {
            "reason": reason,
            "comment": str(r.get("comment") or "")[:1000],
            "question": str(r.get("question") or "")[:4000],
            "answer": str(r.get("answer") or "")[:12000],
            "game": str(r.get("game") or "")[:160],
            "place": str(r.get("place") or "")[:160],
            "messageId": str(r.get("messageId") or "")[:80],
            "appVersion": str(decky.DECKY_PLUGIN_VERSION),
            "client": "deck",
        }
        token, is_guest, notice = await self._bearer()
        if token is None:
            return {"ok": False, "error": notice}
        status, data = await self._http("POST", "/api/report-answer", body=body, token=token)
        if status == 401 and not is_guest:
            token, is_guest, _ = await self._bearer(force_refresh=True)
            if token is not None:
                status, data = await self._http("POST", "/api/report-answer", body=body, token=token)
        if status == 200 and data.get("ok"):
            return {"ok": True}
        return {"ok": False, "error": data.get("error") or f"Could not send the report (HTTP {status})."}

    @staticmethod
    def _public_url_error(url: str) -> Optional[str]:
        """Only public http(s) addresses may be fetched (no file://, localhost or local-network hosts)."""
        parts = urlsplit(url)
        if parts.scheme not in ("http", "https") or not parts.hostname:
            return "Only web addresses (http/https) can be opened."
        host = parts.hostname.lower()
        if host == "localhost" or host.endswith(".local"):
            return "Local addresses can't be opened."
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_reserved:
                return "Local addresses can't be opened."
        except ValueError:
            pass  # a hostname, not an IP literal
        return None

    # ---- Quest Compendium guides (shown natively in the plugin, no browser) ---------------------

    async def _guide_http(self, path: str) -> Tuple[int, Dict[str, Any]]:
        """A guide call to the server: a longer timeout than other calls, and one more try if it got no response."""
        status, data = await self._http("GET", path, timeout_s=GUIDE_TIMEOUT_S)
        if status == 0:
            status, data = await self._http("GET", path, timeout_s=GUIDE_TIMEOUT_S)
        return status, data

    async def _fetch_index(self, url: str) -> Optional[list]:
        """The website's guide index (guides/index.json), or None if it couldn't be read."""
        try:
            timeout = aiohttp.ClientTimeout(total=GUIDE_INDEX_TIMEOUT_S)
            connector = aiohttp.TCPConnector(ssl=self._ssl)
            headers = {"User-Agent": f"QuestCompendiumDeck/{decky.DECKY_PLUGIN_VERSION}"}
            async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                async with session.get(url, headers=headers) as resp:
                    if resp.status != 200:
                        return None
                    data = await resp.json(content_type=None)
                    games = data.get("games") if isinstance(data, dict) else None
                    return games if isinstance(games, list) and games else None
        except (asyncio.TimeoutError, aiohttp.ClientError, ValueError) as e:
            decky.logger.warning(f"Guide index: {type(e).__name__}: {str(e)[:160]}")
            return None

    async def guides_list(self) -> Dict[str, Any]:
        """Games that have a Quest Compendium guide: the website's small index first (tried twice), else the server's
        list (tried twice). Only what the list needs: key, name, cover, page count, checked pages, players."""
        url = getattr(self, "guide_index_url", GUIDE_INDEX_URL)
        for _ in range(2):
            games = await self._fetch_index(url)
            if games:
                return {"ok": True, "games": games, "source": "index"}
        status, data = await self._guide_http("/api/guides")
        if status == 200 and isinstance(data.get("games"), list):
            return {"ok": True, "games": data["games"], "source": "server"}
        return {"ok": False, "error": data.get("error") or f"Guides are unavailable (HTTP {status})."}

    @staticmethod
    def _guide_lang(lang: str = "") -> str:
        """A translated guide where one exists (the server falls back to English)."""
        lang = str(lang or "").lower()
        return f"lang={lang}" if lang in ("es", "pt", "de", "fr", "ru", "ja", "ko", "zh") else ""

    async def guide_find(self, game: str, lang: str = "") -> Dict[str, Any]:
        """The guide for a game by its name (the running Steam game), or ok with key None if there isn't one."""
        name = str(game or "").strip()[:160]
        if not name:
            return {"ok": True, "key": None}
        q = self._guide_lang(lang)
        status, data = await self._guide_http(f"/api/guides/find?game={quote(name)}" + (f"&{q}" if q else ""))
        if status == 200:
            return {"ok": True, **data}
        return {"ok": False, "error": data.get("error") or f"Guides are unavailable (HTTP {status})."}

    async def _site_json(self, path: str, lang: str = "") -> Optional[Dict[str, Any]]:
        """One of the website's guide data files (path under guides/), in the plugin's language when the site has it
        translated, else English. None when it's missing or the site can't be reached: the caller then asks the server."""
        lang = str(lang or "").lower()
        base = getattr(self, "guide_index_url", GUIDE_INDEX_URL).rsplit("/guides/", 1)[0]
        urls = ([f"{base}/{lang}/guides/{path}"] if lang in SITE_LANGS else []) + [f"{base}/guides/{path}"]
        headers = {"User-Agent": f"QuestCompendiumDeck/{decky.DECKY_PLUGIN_VERSION}"}
        try:
            timeout = aiohttp.ClientTimeout(total=SITE_JSON_TIMEOUT_S)
            connector = aiohttp.TCPConnector(ssl=self._ssl)
            async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                for url in urls:
                    async with session.get(url, headers=headers) as resp:
                        if resp.status != 200:
                            continue  # not translated (or not published yet): try English, then the server
                        data = await resp.json(content_type=None)
                        if isinstance(data, dict) and data.get("v"):
                            return data
        except (asyncio.TimeoutError, aiohttp.ClientError, ValueError) as e:
            # Unreachable or garbled: don't wait on the English copy too, the server answers instead.
            decky.logger.warning(f"Guide data {path}: {type(e).__name__}: {str(e)[:160]}")
        return None

    @staticmethod
    def _site_path(*parts: Any) -> str:
        return "/".join(quote(str(p or "")[:120], safe="") for p in parts)

    async def guide_game(self, key: str, lang: str = "") -> Dict[str, Any]:
        """One game's guide areas, in story order. The site's guide.json first ("source": "site": its compendium is
        the site's sections), else the server's list as before."""
        data = await self._site_json(self._site_path(key, "guide.json"), lang)
        if data and isinstance(data.get("areas"), list):
            return {**data, "ok": True, "source": "site"}
        q = self._guide_lang(lang)
        status, data = await self._guide_http(f"/api/guides/{quote(str(key or '')[:120], safe='')}" + (f"?{q}" if q else ""))
        if status == 200 and isinstance(data.get("areas"), list):
            return {"ok": True, **data}
        return {"ok": False, "error": data.get("error") or f"Guide unavailable (HTTP {status})."}

    async def guide_area(self, key: str, slug: str, lang: str = "") -> Dict[str, Any]:
        """One guide page. The site's page.json first ("source": "site"; it may turn out to be a compendium page, which
        its "kind" says), else the server's page as before."""
        data = await self._site_json(self._site_path(key, slug, "page.json"), lang)
        if data and data.get("kind") in ("area", "entity") and data.get("name"):
            return {"ok": True, "source": "site", "page": data}
        q = self._guide_lang(lang)
        path = f"/api/guides/{quote(str(key or '')[:120], safe='')}/{quote(str(slug or '')[:120], safe='')}" + (f"?{q}" if q else "")
        status, data = await self._guide_http(path)
        if status == 200 and data.get("name"):
            return {"ok": True, "page": data}
        return {"ok": False, "error": data.get("error") or f"Page unavailable (HTTP {status})."}

    async def area_facts(self, key: str, slug: str, lang: str = "") -> Dict[str, Any]:
        """An area's facts from the database (roadmap item 30, step 2): what's worth getting and doing there, and its
        achievements with the point of no return that ends each. The server's /api/guides/<key>/<slug>/facts."""
        q = self._guide_lang(lang)
        path = f"/api/guides/{quote(str(key or '')[:120], safe='')}/{quote(str(slug or '')[:120], safe='')}/facts" + (f"?{q}" if q else "")
        status, data = await self._guide_http(path)
        if status != 200 or not isinstance(data, dict):
            return {"ok": False}
        worth = data.get("worth")
        # Item cards' pictures are on our server (/api/wiki-pic/<hash>): the panel needs their full address.
        if isinstance(worth, dict):
            base = self._api_base().rstrip("/")
            for g in worth.get("gear") or []:
                card = g.get("card") if isinstance(g, dict) else None
                if isinstance(card, dict) and isinstance(card.get("pic"), str) and card["pic"].startswith("/"):
                    card["pic"] = base + card["pic"]
        return {"ok": True, "worth": worth, "achievements": data.get("achievements")}

    async def guide_search_index(self, key: str, lang: str = "") -> Dict[str, Any]:
        """A guide's search index from the website (guides/{key}/search.json, in the plugin's language when translated)."""
        lang = str(lang or "").lower()
        prefix = f"{lang}/" if lang in ("es", "pt", "de", "fr", "ru", "ja", "ko", "zh") else ""
        base = getattr(self, "guide_index_url", GUIDE_INDEX_URL).rsplit("/guides/", 1)[0]
        for url in [f"{base}/{prefix}guides/{quote(str(key or '')[:120], safe='')}/search.json", f"{base}/guides/{quote(str(key or '')[:120], safe='')}/search.json"]:
            try:
                timeout = aiohttp.ClientTimeout(total=GUIDE_INDEX_TIMEOUT_S)
                connector = aiohttp.TCPConnector(ssl=self._ssl)
                async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                    async with session.get(url, headers={"User-Agent": f"QuestCompendiumDeck/{decky.DECKY_PLUGIN_VERSION}"}) as resp:
                        if resp.status == 200:
                            data = await resp.json(content_type=None)
                            if isinstance(data, list):
                                return {"ok": True, "index": data}
            except (asyncio.TimeoutError, aiohttp.ClientError, ValueError) as e:
                decky.logger.warning(f"Guide search index: {type(e).__name__}: {str(e)[:160]}")
        return {"ok": False, "error": "The guide's search couldn't be loaded."}

    async def guide_entity(self, key: str, slug: str, lang: str = "") -> Dict[str, Any]:
        """One of a guide's entity pages (the compendium: a place, character or collectible). The site's page.json first
        ("source": "site", as guide_area returns it), else the server's entity as before."""
        data = await self._site_json(self._site_path(key, slug, "page.json"), lang)
        if data and data.get("kind") in ("area", "entity") and data.get("name"):
            return {"ok": True, "source": "site", "page": data}
        path = f"/api/guides/{quote(str(key or '')[:120], safe='')}/entity/{quote(str(slug or '')[:120], safe='')}"
        status, data = await self._guide_http(path)
        if status == 200 and data.get("name"):
            return {"ok": True, "entity": data}
        return {"ok": False, "error": data.get("error") or f"Page unavailable (HTTP {status})."}

    async def guide_achievements(self, key: str, lang: str = "") -> Dict[str, Any]:
        """A guide's achievement guide (Steam's list with tips, plus a roadmap), in the plugin's language."""
        q = self._guide_lang(lang)
        path = f"/api/guides/{quote(str(key or '')[:120], safe='')}/achievements" + (f"?{q}" if q else "")
        status, data = await self._guide_http(path)
        if status == 200 and isinstance(data.get("list"), list) and data["list"]:
            return {"ok": True, "guide": data}
        return {"ok": False, "error": data.get("error") or f"No achievement guide (HTTP {status})."}

    async def fetch_json(self, url: str) -> Dict[str, Any]:
        """Call a public JSON API (the wikis' MediaWiki API for the Guides tab).

        Wikis ask API clients to identify themselves honestly, so this uses the plugin's own User-Agent rather
        than pretending to be a browser (which is exactly what gets blocked).
        """
        url = str(url or "").strip()
        problem = self._public_url_error(url)
        if problem:
            return {"ok": False, "error": problem}
        headers = {
            "User-Agent": f"QuestCompendiumDeck/{decky.DECKY_PLUGIN_VERSION} (https://questcompendium.com; Steam Deck plugin)",
            "Accept": "application/json",
        }
        try:
            timeout = aiohttp.ClientTimeout(total=PAGE_TIMEOUT_S)
            connector = aiohttp.TCPConnector(ssl=self._ssl)
            async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                async with session.get(url, headers=headers, allow_redirects=True, max_redirects=5) as resp:
                    if "json" not in resp.headers.get("Content-Type", ""):
                        return {"ok": False, "status": resp.status, "error": "Not a JSON response."}
                    raw = await _read_limited(resp, MAX_PAGE_BYTES)
                    return {"ok": resp.status < 400, "status": resp.status, "url": str(resp.url), "data": json.loads(raw.decode("utf-8", errors="replace"))}
        except asyncio.TimeoutError:
            return {"ok": False, "error": "The wiki took too long to respond."}
        except (aiohttp.ClientError, ValueError) as e:
            decky.logger.warning(f"fetch_json {urlsplit(url).hostname}: {type(e).__name__}: {str(e)[:200]}")
            return {"ok": False, "error": f"Couldn't reach the wiki ({type(e).__name__})."}
        except Exception as e:
            decky.logger.warning(f"fetch_json unexpected: {type(e).__name__}: {str(e)[:200]}")
            return {"ok": False, "error": "Couldn't reach the wiki."}

    async def fetch_page(self, url: str) -> Dict[str, Any]:
        """Download a web page for the in-plugin reader. Returns the raw HTML; the frontend extracts the text.

        Only public http(s) addresses are allowed (no file://, localhost, or local-network hosts).
        """
        url = str(url or "").strip()
        parts = urlsplit(url)
        if parts.scheme not in ("http", "https") or not parts.hostname:
            return {"ok": False, "error": "Only web addresses (http/https) can be opened."}
        host = parts.hostname.lower()
        if host == "localhost" or host.endswith(".local"):
            return {"ok": False, "error": "Local addresses can't be opened."}
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_reserved:
                return {"ok": False, "error": "Local addresses can't be opened."}
        except ValueError:
            pass  # a hostname, not an IP literal

        headers = {
            "User-Agent": BROWSER_UA,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
            "Accept-Language": "en-US,en;q=0.8",
        }
        try:
            timeout = aiohttp.ClientTimeout(total=PAGE_TIMEOUT_S)
            connector = aiohttp.TCPConnector(ssl=self._ssl)
            async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                async with session.get(url, headers=headers, allow_redirects=True, max_redirects=8) as resp:
                    ctype = resp.headers.get("Content-Type", "")
                    if "html" not in ctype and "xml" not in ctype and "text/plain" not in ctype:
                        return {"ok": False, "status": resp.status, "error": "This link isn't a web page (it may be a file or video)."}
                    raw = await _read_limited(resp, MAX_PAGE_BYTES)
                    try:
                        html = raw.decode(resp.charset or "utf-8", errors="replace")
                    except LookupError:  # unknown charset name
                        html = raw.decode("utf-8", errors="replace")
                    return {"ok": resp.status < 400, "status": resp.status, "url": str(resp.url), "html": html,
                            "error": None if resp.status < 400 else f"The site returned an error (HTTP {resp.status})."}
        except asyncio.TimeoutError:
            return {"ok": False, "error": "The page took too long to load."}
        except aiohttp.ClientError as e:
            decky.logger.warning(f"fetch_page {host}: {type(e).__name__}: {str(e)[:200]}")
            return {"ok": False, "error": f"Couldn't load the page ({type(e).__name__})."}
        except Exception as e:  # never let a bad page take down the backend
            decky.logger.warning(f"fetch_page {host} unexpected: {type(e).__name__}: {str(e)[:200]}")
            return {"ok": False, "error": "Couldn't load the page."}

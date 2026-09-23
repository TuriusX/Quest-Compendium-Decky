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
import os
import pwd
import secrets
import shutil
import ipaddress
from urllib.parse import urlsplit
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

CHAT_TIMEOUT_S = 120          # Pro model + vision can be slow
SHORT_TIMEOUT_S = 20
TOKEN_REFRESH_MARGIN_S = 120  # refresh Firebase ID tokens this long before they expire

MAX_QUESTION_CHARS = 2000
MAX_HISTORY_TURNS = 10
MAX_HISTORY_CHARS = 4000
MAX_IMAGE_BYTES = 6 * 1024 * 1024
SCREENSHOT_MAX_WIDTH = 1280

# In-plugin reader browser
PAGE_TIMEOUT_S = 20
MAX_PAGE_BYTES = 4 * 1024 * 1024
BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36"
)

VALID_MODES = ("standard", "minmax", "roleplay")
VALID_MODELS = ("pro", "flash")

SETTINGS_PATH = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")

DEFAULT_SETTINGS: Dict[str, Any] = {
    "mode": "standard",
    "model": "pro",
    "include_screenshot": True,
    "language": "English",
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
    XDG_RUNTIME_DIR pointing at root's runtime dir. Rebuild both from the real user.
    """
    env = dict(os.environ)
    env["XDG_RUNTIME_DIR"] = f"/run/user/{_target_uid()}"
    orig = env.pop("LD_LIBRARY_PATH_ORIG", None)
    if orig is not None:
        env["LD_LIBRARY_PATH"] = orig
    else:
        env.pop("LD_LIBRARY_PATH", None)
    env.pop("LD_PRELOAD", None)
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
    if not isinstance(user_data, dict):
        return None
    return {
        "pro": _to_int(user_data.get("proQueriesAvailable")),
        "flash": _to_int(user_data.get("flashQueriesAvailable")),
        "isPremium": user_data.get("isPremium") is True,
        "isGuest": user_data.get("isGuest") is True,
    }


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

class Plugin:
    # ---- lifecycle ---------------------------------------------------------------------------

    async def _main(self):
        self.state: Dict[str, Any] = _read_json(SETTINGS_PATH)
        self.state.setdefault("settings", {})
        for key, value in DEFAULT_SETTINGS.items():
            self.state["settings"].setdefault(key, value)
        if not self.state.get("guest_id"):
            self.state["guest_id"] = "guest_deck_" + secrets.token_hex(12)
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

    async def get_state(self) -> Dict[str, Any]:
        env = _clean_env()
        auth = self.state.get("auth")
        return {
            "linked": bool(auth),
            "email": (auth or {}).get("email"),
            "relinkNeeded": bool(self.state.get("relink_needed")),
            "settings": {
                "mode": self.state["settings"]["mode"],
                "model": self.state["settings"]["model"],
                "include_screenshot": bool(self.state["settings"]["include_screenshot"]),
            },
            "tools": {
                "gamescopectl": bool(_which("gamescopectl", env)),
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
        self._save()
        return True

    async def get_quota(self) -> Dict[str, Any]:
        token, _, notice = await self._bearer()
        if token is None:
            return {"ok": False, "error": notice}
        status, data = await self._http("GET", "/api/user/status", token=token)
        if status == 200:
            data.setdefault("isGuest", self.state.get("auth") is None)
            return {"ok": True, "quota": _quota_from(data), "notice": notice}
        return {"ok": False, "error": data.get("error") or f"Server error ({status})"}

    async def test_screenshot(self) -> Dict[str, Any]:
        """Diagnostic: capture but don't send. Returns size/timing, never the image."""
        shot = await self._capture()
        if shot["ok"]:
            return {"ok": True, "bytes": shot["bytes"], "mime": shot["mime"], "ms": shot["ms"]}
        return {"ok": False, "error": shot["error"]}

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
        mode = req.get("mode") if req.get("mode") in VALID_MODES else s["mode"]
        model = req.get("model") if req.get("model") in VALID_MODELS else s["model"]

        history: List[Dict[str, str]] = []
        for turn in (req.get("history") or [])[-MAX_HISTORY_TURNS:]:
            if isinstance(turn, dict) and turn.get("role") in ("user", "assistant") and turn.get("text"):
                history.append({"role": turn["role"], "text": str(turn["text"])[:MAX_HISTORY_CHARS]})

        payload: Dict[str, Any] = {
            "question": question,
            "history": history,
            "aiMode": mode,
            "preferredModel": model,
            "language": s.get("language") or "English",
        }
        game = req.get("game")
        if isinstance(game, dict) and game.get("name"):
            active: Dict[str, Any] = {"name": str(game["name"])[:200]}
            if game.get("appId"):
                active["appId"] = str(game["appId"])
            payload["activeGame"] = active
            payload["isGameRunningLocally"] = True

        screenshot_state, screenshot_error = "off", None
        if req.get("includeScreenshot"):
            shot = await self._capture()
            if shot["ok"]:
                payload["imageBase64"] = f"data:{shot['mime']};base64,{shot['b64']}"
                screenshot_state = "attached"
            else:
                screenshot_state, screenshot_error = "failed", shot["error"]

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
        elif status == 429:
            result.update(ok=True, limitReached=True, text=data.get("text") or "Daily limit reached.")
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
                    raw = await resp.content.read(MAX_PAGE_BYTES)
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

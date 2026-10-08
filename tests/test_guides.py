"""The guide list on the Deck: the REAL plugin backend (main.py) against a small local server standing in for the
website (guides/index.json) and the Quest Compendium server (/api/guides). Runs anywhere aiohttp is installed:

    python3 tests/test_guides.py
"""
import asyncio, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "fakes"))
sys.path.insert(0, os.path.join(HERE, ".."))

from aiohttp import web
if os.name == "nt":  # main.py looks up the Deck user with pwd (Linux only): a stand-in so this test runs on Windows too
    import types
    _pwd = types.ModuleType("pwd")
    def _getpwnam(name):
        raise KeyError(name)
    _pwd.getpwnam = _getpwnam
    sys.modules["pwd"] = _pwd
import main  # the real plugin backend

results = []
def check(name, cond, detail=""):
    cond = bool(cond)
    results.append(cond)
    print(("PASS  " if cond else "FAIL  ") + name + (f"   -> {detail}" if (detail and not cond) else ""))

INDEX = {"v": 1, "games": [{"key": "elden-ring", "game": "ELDEN RING", "areas": 40, "checked": 40, "players": 9}]}
SERVER = {"games": [{"key": "avowed", "game": "Avowed", "areas": 12}]}
calls = {"index": 0, "server": 0, "page": 0}
mode = {"index": "ok", "server": "ok", "page_fail": 0}

async def index(_req):
    calls["index"] += 1
    if mode["index"] == "slow":
        await asyncio.sleep(2)
    if mode["index"] == "missing":
        return web.Response(status=404, text="<html>Not found</html>")
    return web.json_response(INDEX)

async def server_list(_req):
    calls["server"] += 1
    if mode["server"] == "down":
        return web.json_response({"error": "Guides are unavailable right now."}, status=500)
    return web.json_response(SERVER)

async def page(req):
    calls["page"] += 1
    if mode["page_fail"] > 0:
        mode["page_fail"] -= 1
        await asyncio.sleep(2)  # longer than the test's timeout: no response
    return web.json_response({"key": req.match_info["key"], "game": "ELDEN RING", "areas": [{"slug": "limgrave", "name": "Limgrave", "story": ""}]})

async def run():
    app = web.Application()
    app.router.add_get("/guides/index.json", index)
    app.router.add_get("/api/guides", server_list)
    app.router.add_get("/api/guides/{key}", page)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 3112)
    await site.start()
    base = "http://127.0.0.1:3112"

    p = main.Plugin()
    await p._main()
    p.state["settings"]["api_base"] = base
    p.guide_index_url = f"{base}/guides/index.json"

    r = await p.guides_list()
    check("guide list comes from the website's index, not the server", r["ok"] and r["source"] == "index" and r["games"][0]["key"] == "elden-ring" and calls["server"] == 0, r)

    mode["index"] = "missing"
    calls["index"] = 0
    r = await p.guides_list()
    check("index missing: tried twice, then the server's list", r["ok"] and r["source"] == "server" and r["games"][0]["key"] == "avowed" and calls["index"] == 2, (r, calls))

    mode["server"] = "down"
    r = await p.guides_list()
    check("both down: a clear error (the panel shows Retry), never markup", (not r["ok"]) and "<" not in r["error"] and r["error"], r)

    mode["index"] = "slow"
    old = main.GUIDE_INDEX_TIMEOUT_S
    main.GUIDE_INDEX_TIMEOUT_S = 0.5
    calls["index"] = 0
    calls["server"] = 0
    mode["server"] = "ok"
    r = await p.guides_list()
    main.GUIDE_INDEX_TIMEOUT_S = old
    check("slow index times out (twice) and falls back to the server", r["ok"] and r["source"] == "server" and calls["index"] == 2, (r, calls))

    # A guide's pages load only when it's opened, with one automatic retry when the server doesn't answer.
    old = main.GUIDE_TIMEOUT_S
    main.GUIDE_TIMEOUT_S = 0.5
    mode["page_fail"] = 1
    calls["page"] = 0
    r = await p.guide_game("elden-ring")
    check("a guide that times out once is retried automatically", r["ok"] and r["areas"][0]["slug"] == "limgrave" and calls["page"] == 2, (r, calls))
    mode["page_fail"] = 2
    calls["page"] = 0
    r = await p.guide_game("elden-ring")
    check("two timeouts: a clear error after exactly one retry", (not r["ok"]) and "took too long" in r["error"] and calls["page"] == 2, (r, calls))
    main.GUIDE_TIMEOUT_S = old

    await runner.cleanup()
    print(f"\n{sum(results)}/{len(results)} passed")
    sys.exit(0 if all(results) else 1)

asyncio.run(run())

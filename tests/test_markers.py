"""The marker check on the Deck (main.py check_markers): close-ups go to /api/refine, only clean ones, and the reply comes
back as found spots plus how many were checked. Also: answers keep each marker's kind (_points_from)."""
import asyncio, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "fakes"))
sys.path.insert(0, os.path.join(HERE, ".."))
try:
    import aiohttp  # noqa: F401
except ImportError:
    import types
    sys.modules["aiohttp"] = types.ModuleType("aiohttp")
if not hasattr(os, "getuid"):
    os.getuid = lambda: 1000
import main

results = []
def check(name, cond, detail=""):
    results.append(cond)
    print(("PASS  " if cond else "FAIL  ") + name + (f"   -> {detail}" if (detail and not cond) else ""))

JPEG = "data:image/jpeg;base64," + "A" * 100

def plugin(reply_status=200, reply=None, token="t"):
    p = main.Plugin()
    sent = {}
    async def bearer(force_refresh=False):
        return (token, False, None)
    async def http(method, path, *, body=None, token=None, timeout_s=0):
        sent.update(method=method, path=path, body=body, token=token)
        return reply_status, (reply if reply is not None else {})
    p._bearer = bearer
    p._http = http
    return p, sent

async def run():
    crops = [{"image": JPEG, "label": "Chest", "where": "left of the door", "category": "key", "guide": True},
             {"image": "data:image/png;base64,AAAA", "label": "Not a jpeg"},
             {"image": JPEG, "label": ""},
             {"image": JPEG, "label": "Guard", "category": "Bad Kind!"}]
    p, sent = plugin(reply={"found": [{"index": 0, "x": 0.4, "y": 0.6}, {"index": 9, "x": 0.1, "y": 0.1}, {"index": 1, "x": 2, "y": 0}], "checked": 2})
    r = await p.check_markers({"crops": crops, "game": "Baldur's Gate 3"})
    check("posts to /api/refine with the token", sent.get("path") == "/api/refine" and sent.get("token") == "t")
    check("only clean close-ups are sent", [c["label"] for c in sent["body"]["crops"]] == ["Chest", "Guard"], sent["body"]["crops"])
    check("a bad kind is dropped, a good one kept", sent["body"]["crops"][0].get("category") == "key" and "category" not in sent["body"]["crops"][1])
    check("guide entries are flagged", sent["body"]["crops"][0].get("guide") is True and "guide" not in sent["body"]["crops"][1])
    check("says it's the Deck, with its version", sent["body"].get("client") == "deck" and bool(sent["body"].get("appVersion")))
    check("found spots are cleaned", r == {"ok": True, "found": [{"index": 0, "x": 0.4, "y": 0.6}], "checked": 2}, r)

    p, sent = plugin(reply={"found": []})
    r = await p.check_markers({"crops": [{"image": JPEG, "label": f"M{i}"} for i in range(10)]})
    check("at most 8 close-ups", len(sent["body"]["crops"]) == 8)
    check("an older server (no 'checked') counts as 5", r.get("checked") == 5, r)

    p, _ = plugin(reply_status=403, reply={"error": "Part of Premium.", "found": []})
    check("not allowed: the markers stay", (await p.check_markers({"crops": crops}))["ok"] is False)
    p, _ = plugin(token=None)
    check("not signed in: the markers stay", (await p.check_markers({"crops": crops}))["ok"] is False)
    p, sent = plugin()
    check("nothing to check: no request", (await p.check_markers({"crops": []}))["ok"] is False and not sent)

    pts = main._points_from({"points": [{"x": 0.5, "y": 0.5, "label": "Chest", "category": "key"}, {"x": 0.2, "y": 0.2, "label": "X", "category": "<b>"}]})
    check("answers keep each marker's kind", pts[0].get("category") == "key" and "category" not in pts[1], pts)

asyncio.run(run())
print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)

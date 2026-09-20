"""Reproduces the Deck's ClientConnectorCertificateError and verifies the CA-bundle fix.

A local HTTPS server uses a certificate signed by a private CA. Python's default trust store does not
contain that CA (just like Decky's bundled Python has no usable store), so verification fails. Supplying the CA
through main.CA_BUNDLE_CANDIDATES (the same mechanism used for /etc/ssl/certs on SteamOS) must make it succeed,
while verification stays ON (a different, untrusted CA must still be rejected)."""
import asyncio, os, ssl, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "fakes"))
sys.path.insert(0, os.path.join(HERE, ".."))
os.environ["SSL_CERT_FILE"] = "/nonexistent/ca.pem"   # mimic a broken bundled-Python trust store
os.environ.pop("SSL_CERT_DIR", None)

from aiohttp import web
import main

def sh(*a, cwd):
    subprocess.run(a, cwd=cwd, check=True, capture_output=True)

def make_ca_and_cert(d, name):
    sh("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", f"{name}-ca.key", "-out", f"{name}-ca.pem",
       "-days", "2", "-subj", f"/CN=Test CA {name}", cwd=d)
    sh("openssl", "req", "-newkey", "rsa:2048", "-nodes", "-keyout", f"{name}.key", "-out", f"{name}.csr", "-subj", "/CN=localhost", cwd=d)
    open(os.path.join(d, f"{name}.ext"), "w").write("subjectAltName=DNS:localhost,IP:127.0.0.1\n")
    sh("openssl", "x509", "-req", "-in", f"{name}.csr", "-CA", f"{name}-ca.pem", "-CAkey", f"{name}-ca.key", "-CAcreateserial",
       "-out", f"{name}.pem", "-days", "2", "-extfile", f"{name}.ext", cwd=d)

results = []
def check(name, cond, detail=""):
    results.append(cond); print(("PASS  " if cond else "FAIL  ") + name + (f"   -> {detail}" if not cond else ""))

async def run():
    d = tempfile.mkdtemp()
    make_ca_and_cert(d, "good"); make_ca_and_cert(d, "other")
    srv_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); srv_ctx.load_cert_chain(os.path.join(d, "good.pem"), os.path.join(d, "good.key"))
    app = web.Application()
    async def status(_): return web.json_response({"isPremium": False, "proQueriesAvailable": 5, "flashQueriesAvailable": 5})
    app.router.add_get("/api/user/status", status)
    runner = web.AppRunner(app); await runner.setup()
    await web.TCPSite(runner, "127.0.0.1", 3443, ssl_context=srv_ctx).start()

    async def plugin_with(candidates):
        main.CA_BUNDLE_CANDIDATES = tuple(candidates)
        p = main.Plugin(); await p._main()
        p.state["settings"]["api_base"] = "https://localhost:3443"
        return p

    # 1) The bug: no usable CA store -> exactly the error seen on the Deck
    p = await plugin_with([])
    r = await p.get_quota()
    check("BEFORE FIX (no CA bundle): request fails with a certificate error", (not r["ok"]) and "certificate" in r["error"].lower(), r)

    # 2) The fix: OS bundle that contains the issuing CA -> works
    p = await plugin_with([os.path.join(d, "good-ca.pem")])
    r = await p.get_quota()
    check("AFTER FIX (CA bundle supplied): HTTPS request succeeds", r["ok"] and r["quota"]["pro"] == 5, r)

    # 3) Verification is still ON: a bundle that lacks the issuing CA must still be rejected
    p = await plugin_with([os.path.join(d, "other-ca.pem")])
    r = await p.get_quota()
    check("verification still enforced: wrong CA bundle is rejected", (not r["ok"]) and "certificate" in r["error"].lower(), r)

    # 4) Candidate list falls through missing files to the first that exists
    p = await plugin_with(["/nope/one.pem", os.path.join(d, "good-ca.pem")])
    check("skips missing bundle paths, uses the next", (await p.get_quota())["ok"])

    await runner.cleanup()
    print(f"\n{sum(results)}/{len(results)} TLS checks passed"); return all(results)

sys.exit(0 if asyncio.run(run()) else 1)

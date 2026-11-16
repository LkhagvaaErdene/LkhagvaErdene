"""Browser checks for the navbar, the safety hub and photo identification.
Run: python3 tests/e2e_ui.py   (needs: pip install playwright pillow; playwright install chromium)
Uses a local stand-in for Kindwise: NOT a live-service test."""
import json, os, subprocess, sys, time, urllib.request
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
Image.new("RGB", (900, 700), (120, 80, 50)).save("/tmp/e2e_m.jpg")


def sh(cmd, env=None):
    return subprocess.Popen(cmd, env={**os.environ, **(env or {})}, stdin=subprocess.DEVNULL,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


CLEAN = {"STATIC_DIR": "", "MUSHROOM_PROVIDER": "", "KINDWISE_API_KEY": "", "KINDWISE_BASE_URL": ""}
fake = sh(["node", "tests/fake_upstream.mjs", "9912"])
# no STATIC_DIR: the server must find ../docs or ../src by itself
srv = sh(["node", "server/server.js"], {**CLEAN, "PORT": "8811", "MUSHROOM_PROVIDER": "kindwise", "KINDWISE_API_KEY": "test-key-123", "KINDWISE_BASE_URL": "http://127.0.0.1:9912"})
srv_dev = sh(["node", "server/server.js"], {**CLEAN, "PORT": "8787", "MUSHROOM_PROVIDER": "kindwise", "KINDWISE_API_KEY": "test-key-123", "KINDWISE_BASE_URL": "http://127.0.0.1:9912"})
static = sh(["python3", "-m", "http.server", "8813", "-d", "src", "--bind", "127.0.0.1"])
srv_nc = sh(["node", "server/server.js"], {**CLEAN, "PORT": "8812", "MUSHROOM_PROVIDER": "kindwise"})
time.sleep(1.5)
results = []


def check(name, cond, extra=""):
    results.append(bool(cond)); print(("PASS" if cond else "FAIL"), name, extra)


def setup(body):
    r = urllib.request.Request("http://127.0.0.1:9912/__set", data=json.dumps({"status": 200, "body": body}).encode(), method="POST")
    urllib.request.urlopen(r).read()


def sug(n, p):
    return {"name": n, "probability": p, "details": {"common_names": []}}


B = "http://127.0.0.1:8811"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); errs = []

        def page(w, h=800):
            pg = b.new_page(viewport={"width": w, "height": h})
            pg.on("pageerror", lambda e: errs.append(str(e)))
            return pg

        # navbar: nothing clipped on desktop, burger below 1408px
        for w in (1920, 1440, 1408):
            pg = page(w); pg.goto(B + "/#/overview"); pg.wait_for_timeout(600)
            r = pg.evaluate("""()=>({vw:innerWidth,right:Math.max(...[...document.querySelectorAll('.navbar-menu a')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect().right)),burger:getComputedStyle(document.querySelector('.navbar-burger')).display})""")
            check(f"navbar fits at {w}px", r["right"] <= r["vw"] and r["burger"] == "none", str(r)); pg.close()
        for w in (1280, 1024, 390):
            pg = page(w); pg.goto(B + "/#/overview"); pg.wait_for_timeout(600)
            check(f"burger menu at {w}px, no sideways scroll", pg.is_visible(".navbar-burger") and pg.evaluate("document.documentElement.scrollWidth") <= w)
            pg.click(".navbar-burger"); pg.click(".nav-safety > .navbar-link")
            check(f"safety dropdown shows 103 at {w}px", pg.is_visible("a[href='tel:103']")); pg.close()

        # safety hub
        pg = page(1280)
        for tab in ("sos", "check", "facts"):
            pg.goto(f"{B}/#/mushroom-safety-{tab}"); pg.wait_for_selector(".safety-tabs"); pg.wait_for_timeout(300)
            check(f"safety tab {tab} renders with call strip", pg.is_visible(".safety-call") and pg.locator(f".safety-tab--{tab}.is-active").count() == 1)
        pg.goto(B + "/#/mushroom-safety"); pg.wait_for_selector(".gate")
        check("default safety tab is the checklist", pg.locator(".safety-tab--check.is-active").count() == 1)
        pg.goto(B + "/#/mushroom-safety-sos"); pg.wait_for_selector("#rAte")
        pg.fill("#rAte", "2020-01-01T10:00"); pg.fill("#rQ", "<img src=x onerror=window.__x=1>"); pg.wait_for_timeout(200)
        check("doctor info treats input as text", pg.evaluate("!window.__x") and "<img" in pg.input_value("#rTxt"))
        check("timeline pin appears", pg.is_visible("#tlPin"))

        # identify with stand-in upstream
        setup({"result": {"is_mushroom": {"probability": .99}, "classification": {"suggestions": [sug("Amanita phalloides", .55), sug("Agaricus campestris", .3)]}}})
        pg.goto(B + "/#/mushrooms"); pg.wait_for_selector("#mmDrop"); pg.wait_for_timeout(800)
        check("backend reported ready", "kindwise" in pg.inner_text("#mmBackend"))
        check("camera capture input present", pg.get_attribute("#mmCam", "capture") == "environment")
        pg.set_input_files("#mmFile", "/tmp/e2e_m.jpg"); pg.click("#mmIdentify"); pg.wait_for_selector("#mmResTitle", timeout=15000)
        check("deadly candidate flagged, never 'likely'", pg.locator(".mm-status--uncertain").count() == 1 and pg.locator(".message.is-danger").count() >= 1)

        # no key: clear reason, nothing simulated
        pg2 = page(1280); pg2.goto("http://127.0.0.1:8812/#/mushrooms"); pg2.wait_for_selector("#mmDrop"); pg2.wait_for_timeout(800)
        check("missing key explained with setup steps", "KINDWISE_API_KEY" in pg2.inner_text("#mmBackend") and pg2.is_disabled("#mmIdentify"))
        # static-only hosting (Live Server style, other port): page finds the backend on localhost:8787 via CORS
        pg3 = page(1280); pg3.goto("http://localhost:8813/#/mushrooms"); pg3.wait_for_selector("#mmDrop"); pg3.wait_for_timeout(1200)
        check("static page on another port connects to localhost:8787", "kindwise" in pg3.inner_text("#mmBackend"), pg3.inner_text("#mmBackend")[:60])
        pg3.set_input_files("#mmFile", "/tmp/e2e_m.jpg"); pg3.click("#mmIdentify"); pg3.wait_for_selector("#mmResTitle", timeout=15000)
        check("cross-origin identification returns results", pg3.locator(".mm-cand").count() >= 1)
        # backend down: message names the address tried and the fix
        pg4 = page(1280); pg4.goto("http://localhost:8813/?api=http://localhost:9/#/mushrooms"); pg4.wait_for_selector("#mmDrop"); pg4.wait_for_timeout(1500)
        txt = pg4.inner_text("#mmBackend"); check("unreachable message shows address tried", "localhost:9/api" in txt, txt[-120:].replace("\n", " "))
        pg4.goto("http://localhost:8813/?api=#/mushrooms"); pg4.wait_for_timeout(300)
        check("no page errors", not errs, str(errs[:3]))
        b.close()
finally:
    for pr in (fake, srv, srv_nc, srv_dev, static):
        try: os.killpg(pr.pid, 15)
        except Exception: pass
print(f"\n{sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)

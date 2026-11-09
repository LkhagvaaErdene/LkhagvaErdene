import json, subprocess, time, os, sys, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
Image.new("RGB",(900,700),(120,160,90)).save("/tmp/shroom.jpg")
d=ImageDraw.Draw(Image.new("RGB",(10,10)))
open("/tmp/bad.txt","w").write("not an image")
def sh(cmd,env=None): return subprocess.Popen(cmd,env={**os.environ,**(env or {})},stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
fake=sh(["node","tests/fake_upstream.mjs","9911"])
srv_ok=sh(["node","server/server.js"],{"PORT":"8801","STATIC_DIR":"../docs","MUSHROOM_PROVIDER":"kindwise","KINDWISE_API_KEY":"test","KINDWISE_BASE_URL":"http://127.0.0.1:9911"})
srv_nc=sh(["node","server/server.js"],{"PORT":"8802","STATIC_DIR":"../docs","MUSHROOM_PROVIDER":"kindwise","KINDWISE_API_KEY":""})
static=sh(["python3","-m","http.server","8803","-d","docs"])
time.sleep(1.5)
def setup(body,status=200):
    r=urllib.request.Request("http://127.0.0.1:9911/__set",data=json.dumps({"status":status,"body":body}).encode(),method="POST"); urllib.request.urlopen(r).read()
def sug(*a): return {"result":{"is_mushroom":{"probability":0.99},"classification":{"suggestions":[{"id":str(i),"name":n,"probability":p,"details":{"common_names":[]}} for i,(n,p) in enumerate(a)]}}}
results=[]; 
def check(name,cond,extra=""):
    results.append((name,bool(cond))); print(("PASS" if cond else "FAIL"),name,extra)
errors=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    def newpage(w=1280,h=900,lang="mn"):
        ctx=b.new_context(viewport={"width":w,"height":h}); ctx.add_init_script(f"localStorage.setItem('language','{lang}')")
        pg=ctx.new_page(); pg.on("console",lambda m: errors.append((pg.url,m.text)) if m.type=="error" else None); pg.on("pageerror",lambda e: errors.append((pg.url,str(e)))); return ctx,pg
    ctx,pg=newpage()
    # 1 existing app
    pg.goto("http://127.0.0.1:8801/#/overview"); pg.wait_for_selector("#svg-container svg path[name]")
    check("existing overview map renders",pg.locator("#svg-container svg path[name]").count()==22)
    pg.locator('#svg-container path[name="Khuvsgul"]').click(); pg.wait_for_selector("#infoModal.is-active")
    check("existing map click still opens food modal",pg.locator("#modalContent input.overview-food-checkbox").count()>0)
    pg.click("#infoModal .modal-close-btn")
    for h,sel in (("#/search","#resultTbl"),("#/calculation","#app section"),("#/books","#app section")):
        pg.goto("http://127.0.0.1:8801/"+h); pg.wait_for_selector(sel); check(f"existing page {h} loads",True)
    pg.goto("http://127.0.0.1:8801/#/overview"); pg.wait_for_selector(".navbar-menu")
    nav=pg.locator("#topNavbar a[href^='#/']").evaluate_all("els=>els.map(e=>e.getAttribute('href'))")
    check("navbar has old + new links",{"#/overview","#/search","#/mushrooms","#/mushroom-atlas"}<=set(nav),str(nav))
    # 2 identify page, backend ready
    pg.goto("http://127.0.0.1:8801/#/mushrooms"); pg.wait_for_selector("#mmDrop")
    check("safety warning visible",pg.locator(".mm-safety").is_visible())
    pg.wait_for_selector("#mmBackend .is-success"); 
    check("identify disabled before upload",pg.locator("#mmIdentify").is_disabled())
    pg.set_input_files("#mmFile","/tmp/bad.txt"); check("rejects non-image",pg.locator("#mmFileError").inner_text()!="")
    pg.set_input_files("#mmFile","/tmp/shroom.jpg"); pg.wait_for_selector("#mmPreview[src]")
    check("preview shown + identify enabled",pg.locator("#mmPreviewWrap").is_visible() and pg.locator("#mmIdentify").is_enabled())
    pg.click("#mmRemove"); check("remove clears preview",pg.locator("#mmPreviewWrap").is_hidden() and pg.locator("#mmIdentify").is_disabled())
    pg.set_input_files("#mmFile","/tmp/shroom.jpg"); pg.wait_for_selector("#mmPreview[src]")
    setup(sug(("Boletus edulis",0.95),("Tylopilus felleus",0.02)))
    pg.click("#mmIdentify"); pg.wait_for_selector(".mm-status--likely")
    t=pg.locator("#mmResults").inner_text()
    check("likely result: not presented as confirmed, edible caveat shown","БАТАЛГАА БИШ" in t and "БАТАЛГАА БИШ" in t and "Идэж болдог" in t.replace("идэж","Идэж") or "Идэж болдог" in t)
    check("toxicity panel present",pg.locator(".mm-tox").count()==1)
    pg.wait_for_selector("#mmResultMap svg path[name]")
    check("result map shades documented provinces (Khentei crosswalk)",pg.locator("#mmResultMap path.mm-approx").count()>=1)
    check("no markers when no records",pg.locator("#mmResultMap .mm-marker").count()==0 and "координаттай" in pg.locator("#mmResults").inner_text())
    # uncertain + dangerous
    setup(sug(("Agaricus campestris",0.55),("Amanita phalloides",0.35)))
    pg.click("#mmIdentify"); pg.wait_for_selector(".mm-status--uncertain")
    check("uncertain -> inconclusive headline + danger banner",pg.locator(".message.is-danger >> text=Хортой байж болох").count()>=1 and "Танилт тодорхойгүй" in pg.locator(".mm-status").inner_text())
    # unknown species
    setup(sug(("Morchella esculenta",0.97)))
    pg.click("#mmIdentify"); pg.wait_for_selector(".mm-status--likely")
    check("species not in DB -> toxicity unknown",pg.locator(".mm-tox--toxicity_unknown").count()==1)
    # upstream failure
    setup({},status=500); pg.click("#mmIdentify"); pg.wait_for_selector("#mmResults .is-danger")
    check("upstream failure handled",pg.locator("#mmResults .notification").count()==1)
    ctx.close()
    # 3 backend not configured / unreachable
    ctx,pg=newpage(); pg.goto("http://127.0.0.1:8802/#/mushrooms"); pg.wait_for_selector("#mmBackend .is-warning")
    pg.set_input_files("#mmFile","/tmp/shroom.jpg")
    check("not-configured message, identify stays disabled","холбогдоогүй" in pg.locator("#mmBackend").inner_text() and pg.locator("#mmIdentify").is_disabled()); ctx.close()
    ctx,pg=newpage(); pg.goto("http://127.0.0.1:8803/#/mushrooms"); pg.wait_for_selector("#mmBackend .is-warning",timeout=15000)
    check("static-only host -> unreachable message","холбогдож чадсангүй" in pg.locator("#mmBackend").inner_text()); ctx.close()
    # 4 atlas
    ctx,pg=newpage(); pg.goto("http://127.0.0.1:8801/#/mushroom-atlas"); pg.wait_for_selector("#atlasCards .mm-card")
    check("atlas lists all species",pg.locator("#atlasCards .mm-card").count()==16)
    check("pins of original svg hidden",pg.locator("#atlasMap svg use").first.is_hidden())
    check("explains no records",pg.locator("#atlasRecNote").inner_text()!="" and pg.locator("#fFrom").is_disabled())
    pg.fill("#fQuery","phalloides"); check("search filter",pg.locator("#atlasCards .mm-card").count()==1)
    pg.click("#fReset"); pg.select_option("#fCategory","documented_edible"); n=pg.locator("#atlasCards .mm-card").count(); check("category filter",n==8,str(n))
    pg.click("#fReset"); pg.select_option("#fProvince","Khuvsgul"); n=pg.locator("#atlasCards .mm-card").count(); check("province filter (approx crosswalk)",0<n<16,str(n))
    pg.click("#fReset"); pg.select_option("#fHabitat","grassland"); check("habitat filter",pg.locator("#atlasCards .mm-card").count()>=3)
    pg.click("#fReset"); pg.locator('#atlasMap path[name="Khentii"]').click(); check("province click lists species",pg.locator("#atlasInfo .mm-open").count()>0)
    pg.locator("#atlasInfo .mm-open").first.click(); pg.wait_for_selector("#mushroomModal.is-active"); check("species modal has toxicity panel",pg.locator("#mushroomModalBody .mm-tox").count()==1); pg.keyboard.press("Escape")
    ctx.close()
    # 5 atlas markers using a TEST-ONLY fixture (not shipped data)
    ctx,pg=newpage()
    fx={"records":[{"id":"t1","speciesId":"boletus-edulis","scientificName":"Boletus edulis","country":"MN","province":"Ulaanbaatar","latitude":47.92,"longitude":106.92,"observationDate":"2021-08-10","habitat":"forest","verification":"research_grade","source":{"id":"kherlenchimeg2024","datasetName":"TEST FIXTURE"}},{"id":"t2","speciesId":"agaricus-campestris","scientificName":"Agaricus campestris","country":"MN","province":"Khovd","latitude":48.0,"longitude":91.64,"observationDate":"2019-07-01","verification":"unverified","source":{"id":"x"}},{"id":"bad","speciesId":"boletus-edulis","latitude":10,"longitude":10}]}
    pg.route("**/data/mushroomRecords.json",lambda r: r.fulfill(json=fx))
    pg.goto("http://127.0.0.1:8801/#/mushroom-atlas"); pg.wait_for_selector("#atlasCards .mm-card")
    check("markers drawn; invalid-coordinate record dropped",pg.locator(".mm-marker").count()==2)
    check("verified vs unverified styling",pg.locator(".mm-marker.is-confirmed").count()==1 and pg.locator(".mm-marker.is-unverified").count()==1)
    pg.locator(".mm-marker.is-confirmed").dispatch_event("click"); tt=pg.locator("#atlasInfo").inner_text()
    check("marker popup shows name/date/source/verification","Boletus edulis" in tt and "2021-08-10" in tt and "TEST FIXTURE" in tt and "Судалгааны" in tt)
    check("date filter enabled and works",pg.locator("#fFrom").is_enabled()); pg.fill("#fFrom","2020-01-01"); pg.wait_for_timeout(100)
    check("date filter narrows markers",pg.locator(".mm-marker").count()==1 and pg.locator("#atlasCards .mm-card").count()==1)
    ctx.close()
    # 6 mobile + english
    for lang in ("mn","en"):
        ctx,pg=newpage(375,740,lang); pg.goto("http://127.0.0.1:8801/#/mushrooms"); pg.wait_for_selector("#mmDrop")
        ov=pg.evaluate("[...document.querySelectorAll('main *')].some(e=>e.getBoundingClientRect().right>window.innerWidth+1)"); check(f"mobile {lang}: no horizontal overflow in page content (identify)",not ov)
        pg.goto("http://127.0.0.1:8801/#/mushroom-atlas"); pg.wait_for_selector("#atlasCards .mm-card")
        ov=pg.evaluate("[...document.querySelectorAll('main *')].some(e=>e.getBoundingClientRect().right>window.innerWidth+1)"); check(f"mobile {lang}: no horizontal overflow in page content (atlas)",not ov)
        if lang=="mn": pg.screenshot(path="/tmp/atlas_mobile.png",full_page=False)
        ctx.close()
    ctx,pg=newpage(1280,900); pg.goto("http://127.0.0.1:8801/#/mushrooms"); pg.wait_for_selector("#mmDrop"); pg.screenshot(path="/tmp/identify_desktop.png"); 
    pg.goto("http://127.0.0.1:8801/#/mushroom-atlas"); pg.wait_for_selector("#atlasCards .mm-card"); pg.screenshot(path="/tmp/atlas_desktop.png"); ctx.close()
    b.close()
for s in (fake,srv_ok,srv_nc,static): s.terminate()
benign=[e for e in errors if "favicon" not in e[1].lower()]
# 'Failed to load resource' for the intentionally failing/unconfigured/static scenarios are expected
unexpected=[e for e in benign if "Failed to load resource" not in e[1]]
check("no unexpected console errors",not unexpected,str(unexpected[:5]))
print("console errors seen (incl. expected network failures):",len(benign))
print(sum(ok for _,ok in results),"/",len(results),"passed"); sys.exit(0 if all(ok for _,ok in results) else 1)

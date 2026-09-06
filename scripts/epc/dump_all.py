"""Every store, with the brand and fascia names that drive alias matching."""
import os, json, csv, urllib.request
BASE, KEY = os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def get(p):
    r = urllib.request.Request(BASE + p, headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
    return json.load(urllib.request.urlopen(r))

def page(path, cols):
    out, off = [], 0
    while True:
        pg = get(f"{path}?select={cols}&order=id.asc&limit=1000&offset={off}")
        out += pg
        if len(pg) < 1000: break
        off += 1000
    return out

brands  = {b["id"]: b["name"] for b in page("/rest/v1/brands", "id,name")}
fascias = {f["id"]: f for f in page("/rest/v1/fascias", "id,name,brand_id")}
stores  = page("/rest/v1/stores",
               "id,store_id,brand_id,fascia_id,name,address_line_1,address_line_2,"
               "postcode,town,county,size_band,lon,lat,pqi,open_date")
print(f"{len(stores):,} stores, {len(brands)} brands, {len(fascias)} fascias")

F = ["id","store_id","brand_id","brand","fascia_id","fascia","name","address_line_1",
     "address_line_2","postcode","town","county","size_band","lon","lat","pqi","open_date"]
with open("all_stores.csv","w",newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=F); w.writeheader()
    for s in stores:
        s["brand"]  = brands.get(s["brand_id"], "")
        f = fascias.get(s["fascia_id"])
        s["fascia"] = f["name"] if f else ""
        w.writerow({k: s.get(k) for k in F})

# brand -> its fascia trading names, the alias source that needs no curation
alias_src = {}
for f in fascias.values():
    if f.get("brand_id"):
        alias_src.setdefault(f["brand_id"], []).append(f["name"])
json.dump({"brands": brands, "brand_fascias": alias_src},
          open("brand_reference.json","w"))

missing = sum(1 for s in stores if not s.get("brand_id"))
nogeo   = sum(1 for s in stores if s.get("lat") in (None,"") or s.get("lon") in (None,""))
nopc    = sum(1 for s in stores if not (s.get("postcode") or "").strip())
print(f"  no brand: {missing:,}   no coordinates: {nogeo:,}   no postcode: {nopc:,}")

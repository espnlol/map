"""Build public/airports.json from OurAirports CSVs (public domain data).

Usage: python3 scripts/build-airports.py <dir with airports.csv and runways.csv>
Keeps large and medium airports and their runways, in a compact array format:
[ident, iata, name, city, country, lat, lon, elevation_ft, size ("L"|"M"), runways]
runway = [lat1, lon1, lat2, lon2, length_ft, "09L/27R"]
"""
import csv, json, sys

src = sys.argv[1]
keep = {}
for r in csv.DictReader(open(f"{src}/airports.csv", encoding="utf-8")):
    if r["type"] not in ("large_airport", "medium_airport"):
        continue
    try:
        lat, lon = round(float(r["latitude_deg"]), 4), round(float(r["longitude_deg"]), 4)
    except ValueError:
        continue
    elev = int(float(r["elevation_ft"])) if r["elevation_ft"] else None
    keep[r["ident"]] = [r["icao_code"] or r["gps_code"] or r["ident"], r["iata_code"], r["name"], r["municipality"],
                        r["iso_country"], lat, lon, elev, "L" if r["type"] == "large_airport" else "M", []]

for r in csv.DictReader(open(f"{src}/runways.csv", encoding="utf-8")):
    a = keep.get(r["airport_ident"])
    if not a or r["closed"] == "1":
        continue
    try:
        pts = [round(float(r[k]), 5) for k in ("le_latitude_deg", "le_longitude_deg", "he_latitude_deg", "he_longitude_deg")]
    except ValueError:
        continue
    length = int(float(r["length_ft"])) if r["length_ft"] else 0
    a[9].append(pts + [length, f'{r["le_ident"]}/{r["he_ident"]}'])

out = sorted(keep.values(), key=lambda a: (a[8] != "L", a[0]))
json.dump(out, open("public/airports.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "airports,", sum(len(a[9]) for a in out), "runways")

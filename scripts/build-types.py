"""Build public/aircraft-types.json: ICAO type code -> [name, class, wake category].

Usage: python3 scripts/build-types.py <icao_aircraft_types.json> <aircraft.csv.gz>
Sources (tar1090-db, from the Mictronics aircraft database):
  https://raw.githubusercontent.com/wiedehopf/tar1090-db/master/db/icao_aircraft_types.js  (gzipped JSON)
  https://raw.githubusercontent.com/wiedehopf/tar1090-db/csv/aircraft.csv.gz
The class is ICAO's 3-character description (L2J = landplane, 2 jets; H1T = helicopter,
1 turboshaft); the wake category is L/M/H/J. Names are the most common description
used for that type in the aircraft database, tidied up.
"""
import collections, csv, gzip, json, re, sys

types = json.load(open(sys.argv[1]))
names = collections.defaultdict(collections.Counter)
with gzip.open(sys.argv[2], "rt", encoding="utf-8", errors="replace") as f:
    for row in csv.reader(f, delimiter=";"):
        if len(row) > 4 and row[2] and row[4] and not row[4].startswith("Miscode"):
            names[row[2].upper()][row[4].strip()] += 1

KEEP = {"ATR", "BAE", "DHC", "PZL", "MBB", "CASA", "ERJ", "IAI", "HAL", "SOCATA", "MD", "DC", "EMB", "CRJ", "AW", "TBM", "UH", "CH", "AH", "KC", "RC", "II", "III", "IV", "VI", "SP", "ER", "LR", "XL", "XLS", "XR", "MAX", "NG", "SR", "VTOL"}

def tidy(s: str) -> str:
    out = []
    for w in s.split():
        core = re.sub(r"[^A-Za-z]", "", w)
        if core.isupper() and len(core) > 3 and core not in KEEP and not any(c.isdigit() for c in w):
            w = w[0] + w[1:].lower()
        out.append(w)
    s = " ".join(out)
    s = re.sub(r"\bMcdonnell\b", "McDonnell", s)
    s = re.sub(r"\bDE Havilland\b", "De Havilland", s)
    return s

out = {}
for code, t in types.items():
    c = names.get(code)
    name = tidy(c.most_common(1)[0][0]) if c else ""
    out[code] = [name, t.get("desc", ""), t.get("wtc", "")]
# types that appear in the aircraft database but not in the type list
for code, c in names.items():
    if code not in out and re.fullmatch(r"[A-Z0-9]{2,4}", code) and sum(c.values()) >= 3:
        out[code] = [tidy(c.most_common(1)[0][0]), "", ""]

json.dump(out, open("public/aircraft-types.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "types,", sum(1 for v in out.values() if v[0]), "with names")

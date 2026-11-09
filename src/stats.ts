import type { Cause, Crash } from './types'

/** Deaths, counting an unknown number as 0 (only for sorting and sums; check hasDeaths before showing it) */
export const deaths = (c: Crash) => c.fatalities ?? 0
export const hasDeaths = (c: Crash) => c.fatalities != null

/** Groups variants into a family: "Boeing 737-8AS" and "Boeing 737-800" -> "Boeing 737". */
export function aircraftFamily(type: string): string {
  const t = type.replace(/\s*\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
  const rules: [RegExp, (m: RegExpExecArray) => string][] = [
    [/^Boeing (\d{3})/i, (m) => `Boeing ${m[1]}`],
    [/^Boeing (7\d7) (Classic|Next Generation|MAX)/i, (m) => `Boeing ${m[1]}`],
    [/^Boeing ([A-Z]+-?\d+)/i, (m) => `Boeing ${m[1].toUpperCase()}`],
    [/^Airbus (A\d{3})/i, (m) => `Airbus ${m[1].toUpperCase()}`],
    [/^(?:McDonnell )?Douglas ((?:DC|MD|C)-\d+)/i, (m) => `${/^MD/i.test(m[1]) ? 'McDonnell Douglas' : 'Douglas'} ${m[1].toUpperCase()}`],
    [/^(?:McDonnell Douglas )?(MD-\d+)/i, (m) => `McDonnell Douglas ${m[1].toUpperCase()}`],
    [/^Lockheed (?:Martin )?((?:L-|C-)?\d+|[A-Z][a-z]+(?: [A-Z][a-z]+)?)/, (m) => `Lockheed ${m[1]}`],
    [/^(Tupolev Tu|Ilyushin Il|Antonov An|Yakovlev Yak|Mil Mi|Sukhoi Su|Let L|Beriev Be)-(\d+)/i, (m) => `${m[1]}-${m[2]}`],
    [/^(ATR) (\d+)/i, (m) => `ATR ${m[2]}`],
    [/^(Fokker) F?\.?(\d+)/i, (m) => `Fokker ${m[2]}`],
    [/^(Embraer) (?:EMB[- ]?)?(\w+)/i, (m) => `Embraer ${m[2]}`],
    [/^(Bombardier|Canadair) (CRJ|Q|Dash|Global|Challenger)[- ]?(\d*)/i, (m) => `Bombardier ${m[2]}${m[3] ? ` ${m[3]}` : ''}`],
    [/^(de Havilland(?: Canada)?) ([\w.-]+(?: \d+)?)/i, (m) => `${m[1]} ${m[2]}`],
    [/^(Cessna|Piper|Beechcraft|Learjet|Sikorsky|Bell|Convair|Vickers|Hawker Siddeley|Sud Aviation|Aérospatiale|Avro|BAC|British Aerospace|Saab|Dornier|Fairchild|Curtiss|Handley Page|Bristol|Junkers|Ford|Gulfstream|Dassault|Eurocopter|Airspeed|Martin|Grumman) ([\w.-]+)/i, (m) => `${m[1]} ${m[2]}`],
  ]
  for (const [re, f] of rules) {
    const m = re.exec(t)
    if (m) return f(m)
  }
  return t.split(' ').slice(0, 2).join(' ')
}

/** Where it happened, for stats: the ocean/sea for crashes over water, else the country. */
export const place = (c: Crash) => c.region ?? c.country

export interface Group {
  name: string
  crashes: Crash[]
  count: number
  /** Known deaths only */
  deaths: number
  survivors: number
  /** Crashes in the group with no recorded death toll */
  unknownDeaths: number
}

export function groupBy(crashes: Crash[], keys: (c: Crash) => (string | undefined)[]): Group[] {
  const m = new Map<string, Crash[]>()
  for (const c of crashes) {
    for (const k of new Set(keys(c).filter((x): x is string => !!x && x !== 'Unknown'))) {
      const list = m.get(k)
      if (list) list.push(c)
      else m.set(k, [c])
    }
  }
  return [...m].map(([name, list]) => ({
    name,
    crashes: list,
    count: list.length,
    deaths: list.reduce((n, c) => n + deaths(c), 0),
    survivors: list.reduce((n, c) => n + (c.survivors ?? 0), 0),
    unknownDeaths: list.filter((c) => !hasDeaths(c)).length,
  }))
}

export const byAirline = (crashes: Crash[]) => groupBy(crashes, (c) => c.operators ?? (c.operator ? [c.operator] : []))
/** Aircraft families in a crash: from the articles the infobox links to, else from the type names. */
export function familiesOf(c: Crash): string[] {
  const src = c.aircraftFamilies?.length ? c.aircraftFamilies : c.aircraftTypes ?? (c.aircraft ? [c.aircraft] : [])
  return [...new Set(src.map(aircraftFamily))]
}
export const byAircraft = (crashes: Crash[]) => groupBy(crashes, familiesOf)
export const byPlace = (crashes: Crash[]) => groupBy(crashes, (c) => [place(c)])
export const isOcean = (name: string) => /\b(Ocean|Sea|Gulf|Strait|Channel)\b/.test(name)

export const fullDate = (c: Crash) => c.date.length === 10
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weekday = (c: Crash) => new Date(c.date + 'T12:00:00Z').getUTCDay()

export interface TopItem {
  label: string
  sub?: string
  value: string
  crash?: Crash
  /** Opens an airline/aircraft/place breakdown */
  group?: { kind: 'airline' | 'aircraft' | 'place'; name: string }
}

export interface TopList {
  id: string
  title: string
  emoji: string
  blurb: string
  items: TopItem[]
}

const fmt = (n: number) => n.toLocaleString()
const yearOf = (c: Crash) => c.date.slice(0, 4)

function topCrashes(list: Crash[], value: (c: Crash) => string, n = 5): TopItem[] {
  return list.slice(0, n).map((c) => ({ label: c.name, sub: `${yearOf(c)} · ${c.country}`, value: value(c), crash: c }))
}

export function topFives(crashes: Crash[]): TopList[] {
  const lists: TopList[] = []
  const add = (l: TopList) => { if (l.items.length) lists.push(l) }
  const sorted = (f: (c: Crash) => boolean, by: (c: Crash) => number) => crashes.filter(f).sort((a, b) => by(b) - by(a))

  add({ id: 'deadliest', title: 'Deadliest crashes', emoji: '💀', blurb: 'The most lives lost in a single accident.',
    items: topCrashes(sorted(() => true, deaths), (c) => `${fmt(deaths(c))} deaths`) })

  add({ id: 'sole', title: 'Sole survivors', emoji: '🍀', blurb: 'Crashes where exactly one person lived.',
    items: topCrashes(sorted((c) => c.survivors === 1 && deaths(c) > 0, deaths), (c) => `1 of ${fmt(deaths(c) + 1)}`) })

  add({ id: 'miracles', title: 'Everyone walked away', emoji: '😮‍💨', blurb: 'No deaths, the most people aboard.',
    items: topCrashes(sorted((c) => c.fatalities === 0 && (c.survivors ?? 0) > 0, (c) => c.survivors ?? 0), (c) => `${fmt(c.survivors ?? 0)} survived`) })

  add({ id: 'escapes', title: 'Great escapes', emoji: '🚪', blurb: 'Deadly crashes that still had the most survivors.',
    items: topCrashes(sorted((c) => deaths(c) > 0 && (c.survivors ?? 0) > 0, (c) => c.survivors ?? 0), (c) => `${fmt(c.survivors ?? 0)} survived`) })

  add({ id: 'survival-rate', title: 'Best odds in a big crash', emoji: '📈', blurb: 'Highest survival rate with 100+ people aboard and at least one death.',
    items: topCrashes(
      sorted((c) => deaths(c) > 0 && (c.survivors ?? 0) + deaths(c) >= 100, (c) => (c.survivors ?? 0) / ((c.survivors ?? 0) + deaths(c))),
      (c) => `${Math.round(((c.survivors ?? 0) / ((c.survivors ?? 0) + deaths(c))) * 100)}% lived`,
    ) })

  const airlines = byAirline(crashes)
  add({ id: 'airline-count', title: 'Most crashes by airline', emoji: '🏢', blurb: 'Operators with the most accidents on record.',
    items: [...airlines].sort((a, b) => b.count - a.count).slice(0, 5).map((g) => ({ label: g.name, value: `${g.count} crashes`, sub: `${fmt(g.deaths)} deaths`, group: { kind: 'airline', name: g.name } })) })
  add({ id: 'airline-deaths', title: 'Deadliest airlines', emoji: '⚰️', blurb: 'Operators with the most total deaths.',
    items: [...airlines].sort((a, b) => b.deaths - a.deaths).slice(0, 5).map((g) => ({ label: g.name, value: `${fmt(g.deaths)} deaths`, sub: `${g.count} crashes`, group: { kind: 'airline', name: g.name } })) })

  const aircraft = byAircraft(crashes)
  add({ id: 'aircraft-count', title: 'Most crashed aircraft', emoji: '✈️', blurb: 'Aircraft families in the most accidents (popular planes fly more, so crash more).',
    items: [...aircraft].sort((a, b) => b.count - a.count).slice(0, 5).map((g) => ({ label: g.name, value: `${g.count} crashes`, sub: `${fmt(g.deaths)} deaths`, group: { kind: 'aircraft', name: g.name } })) })

  const places = byPlace(crashes)
  add({ id: 'countries', title: 'Countries with the most crashes', emoji: '🗺️', blurb: 'Where on land accidents happened most.',
    items: places.filter((g) => !isOcean(g.name)).sort((a, b) => b.count - a.count).slice(0, 5).map((g) => ({ label: g.name, value: `${g.count} crashes`, sub: `${fmt(g.deaths)} deaths`, group: { kind: 'place', name: g.name } })) })
  add({ id: 'oceans', title: 'Oceans & seas with the most crashes', emoji: '🌊', blurb: 'Accidents that ended over water.',
    items: places.filter((g) => isOcean(g.name)).sort((a, b) => b.count - a.count).slice(0, 5).map((g) => ({ label: g.name, value: `${g.count} crashes`, sub: `${fmt(g.deaths)} deaths`, group: { kind: 'place', name: g.name } })) })

  const years = groupBy(crashes, (c) => [yearOf(c)])
  add({ id: 'deadly-years', title: 'Deadliest years', emoji: '📅', blurb: 'Total deaths across every crash that year.',
    items: [...years].sort((a, b) => b.deaths - a.deaths).slice(0, 5).map((g) => ({ label: g.name, value: `${fmt(g.deaths)} deaths`, sub: `${g.count} crashes` })) })
  add({ id: 'busy-years', title: 'Years with the most crashes', emoji: '📆', blurb: 'Accidents on record per year.',
    items: [...years].sort((a, b) => b.count - a.count).slice(0, 5).map((g) => ({ label: g.name, value: `${g.count} crashes`, sub: `${fmt(g.deaths)} deaths` })) })

  const dated = crashes.filter(fullDate)
  const months = MONTHS.map((m, i) => ({ m, list: crashes.filter((c) => c.date.length >= 7 && +c.date.slice(5, 7) === i + 1) }))
  add({ id: 'months', title: 'Unluckiest months', emoji: '🌙', blurb: 'Which month of the year sees the most crashes.',
    items: months.sort((a, b) => b.list.length - a.list.length).slice(0, 5).map((x) => ({ label: x.m, value: `${x.list.length} crashes`, sub: `${fmt(x.list.reduce((n, c) => n + deaths(c), 0))} deaths` })) })
  const days = DAYS.map((d, i) => ({ d, list: dated.filter((c) => weekday(c) === i) }))
  add({ id: 'weekdays', title: 'Unluckiest days of the week', emoji: '🗓️', blurb: 'Crashes by the day they happened.',
    items: days.sort((a, b) => b.list.length - a.list.length).slice(0, 5).map((x) => ({ label: x.d, value: `${x.list.length} crashes` })) })

  add({ id: 'friday13', title: 'Friday the 13th', emoji: '🐈‍⬛', blurb: 'The deadliest crashes on the unluckiest date.',
    items: topCrashes(sorted((c) => fullDate(c) && weekday(c) === 5 && c.date.endsWith('-13'), deaths), (c) => `${fmt(deaths(c))} deaths`) })
  add({ id: 'holidays', title: 'Holiday crashes', emoji: '🎄', blurb: 'Deadliest crashes on Christmas Eve, Christmas Day or New Year’s Day.',
    items: topCrashes(sorted((c) => /-(12-24|12-25|01-01)$/.test(c.date), deaths), (c) => `${c.date.slice(5) === '01-01' ? 'New Year' : c.date.endsWith('24') ? 'Xmas Eve' : 'Xmas'} · ${fmt(deaths(c))}`) })

  add({ id: 'north', title: 'Farthest north', emoji: '🧊', blurb: 'The crash sites closest to the North Pole.',
    items: topCrashes([...crashes].sort((a, b) => b.lat - a.lat), (c) => `${c.lat.toFixed(1)}°N`) })
  add({ id: 'south', title: 'Farthest south', emoji: '🐧', blurb: 'The crash sites closest to the South Pole.',
    items: topCrashes([...crashes].sort((a, b) => a.lat - b.lat), (c) => `${Math.abs(c.lat).toFixed(1)}°S`) })
  add({ id: 'oldest', title: 'Oldest on record', emoji: '🕰️', blurb: 'The earliest accidents in the atlas.',
    items: topCrashes([...crashes].sort((a, b) => a.date.localeCompare(b.date)), (c) => yearOf(c)) })

  const causeDeaths = groupBy(crashes, (c) => [c.cause])
  add({ id: 'causes', title: 'Deadliest causes', emoji: '🔎', blurb: 'Total deaths by known cause.',
    items: [...causeDeaths].sort((a, b) => b.deaths - a.deaths).slice(0, 5).map((g) => ({ label: g.name as Cause, value: `${fmt(g.deaths)} deaths`, sub: `${g.count} crashes` })) })

  return lists
}

export function countBy<K extends string>(crashes: Crash[], key: (c: Crash) => K | undefined, value: (c: Crash) => number = () => 1) {
  const m = new Map<K, number>()
  for (const c of crashes) {
    const k = key(c)
    if (k !== undefined) m.set(k, (m.get(k) ?? 0) + value(c))
  }
  return m
}

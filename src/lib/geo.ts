const R_NM = 3440.065

const toRad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in nautical miles. */
export function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R_NM * Math.asin(Math.sqrt(a))
}

/** Move a point along a bearing (degrees) by a distance in nm. */
export function destinationPoint(lat: number, lon: number, bearing: number, nm: number): [number, number] {
  const d = nm / R_NM
  const b = toRad(bearing)
  const p1 = toRad(lat)
  const l1 = toRad(lon)
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b))
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2))
  return [(p2 * 180) / Math.PI, ((((l2 * 180) / Math.PI + 540) % 360) - 180)]
}

export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

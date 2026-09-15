import type { BoundaryShape, Coordinates } from '../types'

const EARTH_RADIUS_MILES = 3958.8

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle distance between two coordinates, in miles. */
export function distanceMiles(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return EARTH_RADIUS_MILES * c
}

/**
 * Ray-casting point-in-polygon test. Used to let users draw an arbitrary
 * shape (not just a circle) on the map — e.g. tracing along roads — and
 * filter dispensaries to whatever falls inside it.
 */
export function pointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat

    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Whether a coordinate falls within the given search boundary (if any).
 * For a multi-shape polygon boundary, "within" means inside at least one
 * of the drawn shapes — not all of them. */
export function isWithinBoundary(point: Coordinates, boundary: BoundaryShape): boolean {
  if (!boundary) return true
  if (boundary.kind === 'circle') {
    return distanceMiles(point, boundary.center) <= boundary.radiusMiles
  }
  return boundary.polygons.some((polygon) => pointInPolygon(point, polygon))
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) return 'under 0.1 mi'
  return `${miles.toFixed(1)} mi`
}

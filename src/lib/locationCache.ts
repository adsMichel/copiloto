export type CachedTripLocation = {
  lat: number;
  lng: number;
  timestamp: number; // ms since epoch
};

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const TTL_MS = Number.isFinite(Number(process.env.LOCATION_CACHE_TTL_MS))
  ? Number(process.env.LOCATION_CACHE_TTL_MS)
  : DEFAULT_TTL_MS;

const lastLocationByTripCode = new Map<string, CachedTripLocation>();

export function setTripLastLocation(tripCode: string, loc: CachedTripLocation) {
  lastLocationByTripCode.set(tripCode, loc);
}

export function getTripLastLocation(tripCode: string): CachedTripLocation | null {
  const loc = lastLocationByTripCode.get(tripCode);
  if (!loc) return null;
  if (Date.now() - loc.timestamp > TTL_MS) {
    lastLocationByTripCode.delete(tripCode);
    return null;
  }
  return loc;
}


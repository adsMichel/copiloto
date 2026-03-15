export type CreateTripPayload = {
  email: string;
  name?: string;
};

export type TripResponse = {
  shareCode: string;
  token?: string;
};

export type TripDetail = {
  id: string;
  shareCode: string;
  isActive: boolean;
  startedAt: string;
  lastLatitude?: number;
  lastLongitude?: number;
};

export type TripHistoryPoint = {
  lat: number;
  lng: number;
  createdAt: string;
};

export type TripHistoryResponse = {
  points: TripHistoryPoint[];
  nextCursor: string | null;
};

export async function createTrip(payload: CreateTripPayload): Promise<TripResponse> {
  const res = await fetch('/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to create trip');
  }

  const json = await res.json();
  if (!json?.shareCode || typeof json.shareCode !== 'string') {
    throw new Error('Invalid response from server');
  }

  return json;
}

export async function getTrip(code: string): Promise<TripDetail> {
  const res = await fetch(`/api/trips/${code}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Trip not found');
  }
  return res.json();
}

export async function getTripHistory(
  code: string,
  opts?: { limit?: number; cursor?: string }
): Promise<TripHistoryResponse> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.cursor) params.set('cursor', opts.cursor);

  const res = await fetch(`/api/trips/${code}/history?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to fetch history');
  }
  return res.json();
}

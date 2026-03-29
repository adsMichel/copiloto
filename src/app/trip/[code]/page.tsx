'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import { getTrip, getTripHistory } from '@/lib/api';
import { getAuthToken } from '@/lib/storage';
import { joinTripRoom, sendLocationUpdate, setAuthToken } from '@/lib/socket';

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), {
  ssr: false,
});
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), {
  ssr: false,
});
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), {
  ssr: false,
});

function MapViewUpdater({ map, center }: { map: LeafletMap; center: LatLngExpression }) {
  useEffect(() => {
    map.setView(center);
  }, [center, map]);

  return null;
}

function formatCoords(lat?: number, lng?: number) {
  return lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '—';
}

export default function TripPage() {
  const router = useRouter();
  const params = useParams();
  const tripCodeRaw = params?.code;
  const tripCode = Array.isArray(tripCodeRaw) ? tripCodeRaw[0] : tripCodeRaw;
  const isValidTripCode = typeof tripCode === 'string' && tripCode.length > 0 && tripCode !== 'undefined';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      setAuthToken(token);
    }
  }, []);

  useEffect(() => {
    if (!isValidTripCode) {
      setLoading(false);
      setError('Código de viagem inválido. Verifique se o link está correto.');

      const timeout = window.setTimeout(() => {
        router.push('/');
      }, 3000);

      return () => {
        window.clearTimeout(timeout);
      };
    }
  }, [isValidTripCode, router]);

  const [leafletIconsReady, setLeafletIconsReady] = useState(false);

  // Fix Leaflet marker icons when bundling with Next.js / Turbopack.
  // Leaflet expects `window` to exist at import time, so we load it dynamically.
  useEffect(() => {
    import('leaflet').then((L) => {
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/marker-icon-2x.png',
        iconUrl: '/marker-icon.png',
        shadowUrl: '/marker-shadow.png',
      });
      setLeafletIconsReady(true);
    });
  }, []);

  const [trip, setTrip] = useState<{ shareCode: string; lastLatitude?: number; lastLongitude?: number } | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [path, setPath] = useState<Array<[number, number]>>([]);
  const [historyPoints, setHistoryPoints] = useState<Array<{ lat: number; lng: number; createdAt: string }>>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);

  const mapRef = useRef<LeafletMap | null>(null);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);

  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [socketError, setSocketError] = useState<string | null>(null);

  const watchId = useRef<number | null>(null);

  const handleMapRef = useCallback((map: LeafletMap | null) => {
    mapRef.current = map;
    setMapInstance(map);
  }, []);

  useEffect(() => {
    if (!isValidTripCode) return;

    async function loadTrip() {
      setLoading(true);
      try {
        const data = await getTrip(tripCode as string);
        setTrip(data);

        const history = await getTripHistory(tripCode as string, { limit: 200 });
        const points = history.points.map((p) => [p.lat, p.lng] as [number, number]);
        setHistoryPoints(history.points);
        setPath(points);

        if (points.length > 0) {
          setPosition(points[points.length - 1]);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    loadTrip();
  }, [isValidTripCode, tripCode]);

  useEffect(() => {
    if (!trip) return;

    joinTripRoom(trip.shareCode);

    const onLocationUpdate = (payload: { lat: number; lng: number }) => {
      const next: [number, number] = [payload.lat, payload.lng];
      setPosition(next);
      setPath((prev) => [...prev, next]);
    };

    const onConnect = () => {
      setSocketStatus('connected');
      setSocketError(null);
    };

    const onDisconnect = () => {
      setSocketStatus('disconnected');
    };

    const onError = (err: unknown) => {
      setSocketStatus('error');
      setSocketError(String(err));
    };

    window.socket?.on('connect', onConnect);
    window.socket?.on('disconnect', onDisconnect);
    window.socket?.on('connect_error', onError);
    window.socket?.on('location:update', onLocationUpdate);

    return () => {
      window.socket?.off('connect', onConnect);
      window.socket?.off('disconnect', onDisconnect);
      window.socket?.off('connect_error', onError);
      window.socket?.off('location:update', onLocationUpdate);
    };
  }, [trip]);

  useEffect(() => {
    if (!trip) return;

    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // Update the local map immediately, even before socket echoes back.
          setPosition([lat, lng]);
          setPath((prev) => [...prev, [lat, lng]]);

          sendLocationUpdate(trip.shareCode, lat, lng);
        },
        (err) => {
          console.warn('Geolocation failed', err);
          setError('Falha ao obter localização. Verifique as permissões do navegador.');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [trip]);

  // Replay effect
  useEffect(() => {
    if (!isReplaying || historyPoints.length === 0) return;

    const interval = window.setInterval(() => {
      setReplayIndex((prev) => {
        if (prev + 1 >= historyPoints.length) {
          setIsReplaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 600);

    return () => {
      window.clearInterval(interval);
    };
  }, [isReplaying, historyPoints]);

  const initialPosition = useMemo<[number, number]>(() => {
    return trip?.lastLatitude != null && trip?.lastLongitude != null
      ? [trip.lastLatitude, trip.lastLongitude]
      : [0, 0];
  }, [trip]);

  const markerPosition = useMemo<[number, number] | null>(() => {
    if (isReplaying && historyPoints.length > 0) {
      const p = historyPoints[replayIndex];
      return p ? [p.lat, p.lng] : null;
    }

    if (position) return position;
    if (trip?.lastLatitude != null && trip?.lastLongitude != null) {
      return [trip.lastLatitude, trip.lastLongitude];
    }
    return null;
  }, [isReplaying, historyPoints, replayIndex, position, trip]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p>Carregando viagemâ€¦</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <p>Ocorreu um erro: {error}</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Voltar
        </button>
      </div>
    );
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  async function handleShare() {
    if (!shareUrl) return;

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (navigator as any).share({
          title: 'Copiloto',
          text: 'Acompanhe minha viagem em tempo real',
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled or unsupported payload; fallback to clipboard
      }
    }

    await navigator.clipboard.writeText(shareUrl);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/60 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Acompanhando viagem</h1>
            <p className="text-sm text-slate-300">
              Código: <span className="font-mono">{tripCode}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">
              Localização atual:{' '}
              {formatCoords(
                markerPosition ? Number(markerPosition[0]) : undefined,
                markerPosition ? Number(markerPosition[1]) : undefined
              )}
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">
              Status de conexão: <span className="font-semibold">{socketStatus}</span>
              {socketError ? <span className="block text-xs text-rose-300">{socketError}</span> : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleShare}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Compartilhar viagem
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplayIndex(0);
                  setIsReplaying((prev) => !prev);
                }}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/20"
              >
                {isReplaying ? 'Pausar replay' : 'Reproduzir replay'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-6 max-w-6xl px-6 pb-10">
        <div className="h-[60vh] w-full overflow-hidden rounded-3xl border border-white/10">
          <MapContainer
            key={trip?.shareCode ?? tripCode}
            center={position ?? initialPosition}
            zoom={13}
            scrollWheelZoom
            className="h-full w-full"
            ref={handleMapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapInstance ? <MapViewUpdater center={markerPosition ?? initialPosition} map={mapInstance} /> : null}
            {markerPosition && leafletIconsReady ? <Marker position={markerPosition} /> : null}
            {path.length > 1 ? <Polyline positions={path} pathOptions={{ color: '#38bdf8' }} /> : null}
          </MapContainer>
        </div>
      </section>
    </main>
  );
}

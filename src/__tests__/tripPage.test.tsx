import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';

// Mocks for Next.js navigation hooks
const pushMock = jest.fn();
const useParamsMock = jest.fn(() => ({ code: 'test-code' }));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => useParamsMock(),
}));

// Mock next/dynamic to simply render a placeholder without leaking props into a DOM element
jest.mock('next/dynamic', () => {
  return () => () => <div data-testid="dynamic" />;
});

// Mock leaflet so it doesn't try to access browser APIs during tests
jest.mock('leaflet', () => ({
  Icon: {
    Default: {
      mergeOptions: jest.fn(),
    },
  },
}));

// Mock our API and socket helpers
const getTripMock = jest.fn();
const getTripHistoryMock = jest.fn();
const joinTripRoomMock = jest.fn();
const sendLocationUpdateMock = jest.fn();
const setAuthTokenMock = jest.fn();

jest.mock('@/lib/api', () => ({
  getTrip: (code: string) => getTripMock(code),
  getTripHistory: (code: string, opts?: { limit?: number; cursor?: string }) =>
    getTripHistoryMock(code, opts),
}));

jest.mock('@/lib/socket', () => ({
  joinTripRoom: (code: string) => joinTripRoomMock(code),
  sendLocationUpdate: (code: string, lat: number, lng: number) => sendLocationUpdateMock(code, lat, lng),
  setAuthToken: (token: string | null) => setAuthTokenMock(token),
}));

// Provide a minimal geolocation implementation for jsdom
// This prevents errors when the component calls navigator.geolocation.watchPosition
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    watchPosition: jest.fn().mockImplementation((success) => {
      success({ coords: { latitude: 10, longitude: 20 } });
      return 1;
    }),
    clearWatch: jest.fn(),
  },
});

// Provide a minimal window.socket so the component can call window.socket?.on/off
// (as it does in useEffect)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).window = global as any;

const socketHandlers: Record<string, (...args: any[]) => void> = {};
const socketOnMock = jest.fn((event: string, cb: (...args: any[]) => void) => {
  socketHandlers[event] = cb;
});
const socketOffMock = jest.fn((event: string) => {
  delete socketHandlers[event];
});
let locationUpdateHandler: ((payload: { lat: number; lng: number }) => void) | null = null;

;(global as any).window.socket = {
  on: socketOnMock,
  off: socketOffMock,
};

import TripPage from '@/app/trip/[code]/page';

describe('TripPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(socketHandlers).forEach((key) => delete socketHandlers[key]);
    useParamsMock.mockReturnValue({ code: 'test-code' });
    locationUpdateHandler = null;
    socketOnMock.mockImplementation((event: string, cb: (...args: any[]) => void) => {
      socketHandlers[event] = cb;
      if (event === 'location:update') {
        locationUpdateHandler = cb as (payload: { lat: number; lng: number }) => void;
      }
    });
    socketOffMock.mockImplementation((event: string) => {
      delete socketHandlers[event];
      if (event === 'location:update') {
        locationUpdateHandler = null;
      }
    });

    getTripMock.mockResolvedValue({
      id: '1',
      shareCode: 'test-code',
      isActive: true,
      startedAt: new Date().toISOString(),
      lastLatitude: 12.34,
      lastLongitude: 56.78,
    });

    getTripHistoryMock.mockResolvedValue({
      points: [
        { lat: 12.34, lng: 56.78, createdAt: new Date().toISOString() },
      ],
      nextCursor: null,
    });
  });

  it('renders and calls getTrip / joinTripRoom', async () => {
    const { container } = render(<TripPage />);

    await waitFor(() => expect(getTripMock).toHaveBeenCalledWith('test-code'));
    await waitFor(() => expect(getTripHistoryMock).toHaveBeenCalledWith('test-code', expect.any(Object)));

    await waitFor(() => expect(joinTripRoomMock).toHaveBeenCalled());
    expect(joinTripRoomMock).toHaveBeenCalledWith('test-code');

    expect(screen.getByText(/Acompanhando viagem/i)).toBeInTheDocument();
    expect(screen.getByText(/Código:/i)).toBeInTheDocument();

    // Ensure the dynamic map placeholder renders
    expect(container.querySelector('[data-testid="dynamic"]')).toBeInTheDocument();

    // Geolocation mock should update the current location display
    await waitFor(() =>
      expect(screen.getByText(/Localização atual:/i)).toHaveTextContent('10.00000, 20.00000')
    );
  });

  it('shows an error and redirects to home when trip code is invalid', async () => {
    jest.useFakeTimers();
    useParamsMock.mockReturnValue({ code: 'undefined' });

    render(<TripPage />);

    expect(await screen.findByText(/Código de viagem inválido/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(pushMock).toHaveBeenCalledWith('/');
    jest.useRealTimers();
  });

  it('shows an error when getTrip fails and allows returning home', async () => {
    getTripMock.mockRejectedValue(new Error('Viagem não encontrada'));

    render(<TripPage />);

    expect(await screen.findByText(/Ocorreu um erro/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Voltar/i }));
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('updates location when socket emits location:update', async () => {
    render(<TripPage />);

    await waitFor(() => expect(joinTripRoomMock).toHaveBeenCalled());

    act(() => {
      locationUpdateHandler?.({ lat: 30, lng: 40 });
    });

    expect(screen.getByText(/Localização atual:/i)).toHaveTextContent('30.00000, 40.00000');
  });

  it('updates connection status based on socket events', async () => {
    render(<TripPage />);

    await waitFor(() => expect(joinTripRoomMock).toHaveBeenCalled());

    // initial status should be connecting
    expect(screen.getByText(/Status de conexão:/i)).toHaveTextContent('connecting');

    act(() => {
      socketHandlers.connect?.();
    });

    expect(screen.getByText(/Status de conexão:/i)).toHaveTextContent('connected');

    act(() => {
      socketHandlers.disconnect?.();
    });

    expect(screen.getByText(/Status de conexão:/i)).toHaveTextContent('disconnected');

    act(() => {
      socketHandlers.connect_error?.('fail');
    });

    expect(screen.getByText(/Status de conexão:/i)).toHaveTextContent('error');
    expect(screen.getByText(/fail/)).toBeInTheDocument();
  });

  it('plays back history points when replay is started', async () => {
    jest.useFakeTimers();

    getTripHistoryMock.mockResolvedValueOnce({
      points: [
        { lat: 1, lng: 2, createdAt: new Date().toISOString() },
        { lat: 3, lng: 4, createdAt: new Date().toISOString() },
      ],
      nextCursor: null,
    });

    render(<TripPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Reproduzir replay/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Reproduzir replay/i }));

    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(screen.getByText(/Localização atual:/i)).toHaveTextContent('3.00000, 4.00000');

    jest.useRealTimers();
  });

  it('sets auth token from localStorage into socket helper', async () => {
    window.localStorage.setItem('copiloto:authToken', 'token-xyz');

    render(<TripPage />);
    await waitFor(() => expect(setAuthTokenMock).toHaveBeenCalledWith('token-xyz'));
  });
});

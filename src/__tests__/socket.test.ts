jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
    auth: {},
  })),
}));

describe('socket helper', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  type MockSocket = {
    connect: jest.Mock;
    disconnect: jest.Mock;
    connected: boolean;
    auth: Record<string, unknown>;
  };

  it('creates socket with auth token when setAuthToken is called', async () => {
    const { getSocket, setAuthToken } = await import('@/lib/socket');
    const { io } = await import('socket.io-client');

    setAuthToken('my-token');
    getSocket();

    expect(io).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          token: 'my-token',
        }),
      })
    );
  });

  it('reconnects socket when token changes', async () => {
    const { getSocket, setAuthToken } = await import('@/lib/socket');
    const socket = getSocket() as unknown as MockSocket;
    socket.connected = true;

    setAuthToken('other-token');

    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.connect).toHaveBeenCalled();
  });
});

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

  it('creates socket with auth token when setAuthToken is called', () => {
    const { getSocket, setAuthToken } = require('@/lib/socket');
    const { io } = require('socket.io-client');

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

  it('reconnects socket when token changes', () => {
    const { getSocket, setAuthToken } = require('@/lib/socket');
    const socket = getSocket();
    (socket as any).connected = true;

    setAuthToken('other-token');

    expect((socket as any).disconnect).toHaveBeenCalled();
    expect((socket as any).connect).toHaveBeenCalled();
  });
});

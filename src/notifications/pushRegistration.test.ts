import { apiFetch } from '@/lib/api';
import { getPushToken } from './pushNative';
import {
  clearPendingUnregister,
  clearStoredRegistration,
  getPendingUnregister,
  getStoredRegistration,
  setPendingUnregister,
  setStoredRegistration,
} from './pushStorage';
import {
  flushPendingUnregister,
  markPendingUnregister,
  registerPushToken,
  resumePushRegistration,
  unregisterPushToken,
} from './pushRegistration';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));
jest.mock('./pushNative', () => ({ getPushToken: jest.fn() }));
jest.mock('./pushStorage', () => ({
  getStoredRegistration: jest.fn(),
  setStoredRegistration: jest.fn(),
  clearStoredRegistration: jest.fn(),
  getPendingUnregister: jest.fn(),
  setPendingUnregister: jest.fn(),
  clearPendingUnregister: jest.fn(),
}));

const api = apiFetch as jest.Mock;
const tokenMock = getPushToken as jest.Mock;
const getStored = getStoredRegistration as jest.Mock;
const getPending = getPendingUnregister as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  resumePushRegistration();
  tokenMock.mockResolvedValue('tok');
  getStored.mockResolvedValue(null);
  getPending.mockResolvedValue(null);
  api.mockResolvedValue({});
  [setStoredRegistration, clearStoredRegistration, setPendingUnregister, clearPendingUnregister].forEach((m) =>
    (m as jest.Mock).mockResolvedValue(undefined),
  );
});

describe('registerPushToken', () => {
  it('posts and stores the record for the current account', async () => {
    expect(await registerPushToken('u1', () => 'u1', 5)).toBe(true);
    expect(api).toHaveBeenCalledWith('/push-tokens', expect.objectContaining({ method: 'POST' }));
    expect(setStoredRegistration).toHaveBeenCalledWith({ token: 'tok', userId: 'u1', at: 5 });
  });

  it('does not post when the account is gone before the request', async () => {
    let user: string | null = 'u1';
    tokenMock.mockImplementation(async () => {
      user = null; // logout while the token is being fetched
      return 'tok';
    });
    expect(await registerPushToken('u1', () => user)).toBe(false);
    expect(api).not.toHaveBeenCalled();
    expect(setStoredRegistration).not.toHaveBeenCalled();
  });

  it('does not store the record and queues the token when logout happens during the POST', async () => {
    let user: string | null = 'u1';
    api.mockImplementation(async () => {
      user = null;
    });
    expect(await registerPushToken('u1', () => user)).toBe(false);
    expect(setStoredRegistration).not.toHaveBeenCalled();
    expect(setPendingUnregister).toHaveBeenCalledWith({ token: 'tok' });
  });

  it('aborts a registration that started before an unregister (epoch)', async () => {
    getStored.mockImplementationOnce(async () => {
      await markPendingUnregister();
      return null;
    });
    expect(await registerPushToken('u1', () => 'u1')).toBe(false);
    expect(api).not.toHaveBeenCalled();
  });

  it('refuses to register while a logout is in progress', async () => {
    await unregisterPushToken();
    expect(await registerPushToken('u1', () => 'u1')).toBe(false);
    resumePushRegistration();
    expect(await registerPushToken('u1', () => 'u1')).toBe(true);
  });

  it('clears an earlier pending removal of the same token after a fresh registration', async () => {
    getPending.mockResolvedValue({ token: 'tok' });
    await registerPushToken('u1', () => 'u1');
    expect(clearPendingUnregister).toHaveBeenCalled();
  });
});

describe('unregisterPushToken', () => {
  beforeEach(() => getStored.mockResolvedValue({ token: 'tok', userId: 'u1', at: 1 }));

  it('deletes the token and clears the record', async () => {
    await unregisterPushToken();
    expect(api).toHaveBeenCalledWith('/push-tokens/tok', { method: 'DELETE' });
    expect(setPendingUnregister).not.toHaveBeenCalled();
    expect(clearStoredRegistration).toHaveBeenCalled();
  });

  it('keeps a pending unregister when the DELETE fails retryably', async () => {
    api.mockRejectedValue(new Error('network'));
    await unregisterPushToken();
    expect(setPendingUnregister).toHaveBeenCalledWith({ token: 'tok' });
    expect(clearStoredRegistration).toHaveBeenCalled();
  });

  it('drops the token on a definitive 4xx answer', async () => {
    api.mockRejectedValue(Object.assign(new Error('nf'), { status: 404 }));
    await unregisterPushToken();
    expect(setPendingUnregister).not.toHaveBeenCalled();
  });
});

describe('markPendingUnregister / flushPendingUnregister', () => {
  it('turns the record into a pending unregister when the session is lost', async () => {
    getStored.mockResolvedValue({ token: 'tok', userId: 'u1', at: 1 });
    await markPendingUnregister();
    expect(setPendingUnregister).toHaveBeenCalledWith({ token: 'tok' });
    expect(clearStoredRegistration).toHaveBeenCalled();
  });

  it('does nothing without a record', async () => {
    await markPendingUnregister();
    expect(setPendingUnregister).not.toHaveBeenCalled();
  });

  it('retries the removal and clears it on success', async () => {
    getPending.mockResolvedValue({ token: 'tok' });
    await flushPendingUnregister();
    expect(api).toHaveBeenCalledWith('/push-tokens/tok', { method: 'DELETE' });
    expect(clearPendingUnregister).toHaveBeenCalled();
  });

  it('keeps it when the retry fails again, and skips a token that was registered again', async () => {
    getPending.mockResolvedValue({ token: 'tok' });
    api.mockRejectedValue(new Error('network'));
    await flushPendingUnregister();
    expect(clearPendingUnregister).not.toHaveBeenCalled();

    api.mockClear();
    getStored.mockResolvedValue({ token: 'tok', userId: 'u1', at: 1 });
    await flushPendingUnregister();
    expect(api).not.toHaveBeenCalled();
    expect(clearPendingUnregister).toHaveBeenCalled();
  });
});

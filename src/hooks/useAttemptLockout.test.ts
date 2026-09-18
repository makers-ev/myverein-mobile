import { act, renderHook } from '@testing-library/react-native';

import { useAttemptLockout } from './useAttemptLockout';

// @testing-library/react-native v14 changed both `renderHook` and `act` to
// always be async (act's callback is unconditionally wrapped in
// `async () => await callback()` -- see dist/act.js) -- unlike the classic
// react-test-renderer-based v12/v13 API, every `act(...)` and `renderHook`
// call here must be awaited or the state update it schedules hasn't
// committed yet when the following assertion runs.

describe('useAttemptLockout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('locks out after 5 failures and further registerFailure calls are no-ops while locked', async () => {
    const { result } = await renderHook(() => useAttemptLockout(5, 30));

    await act(() => {
      for (let i = 0; i < 5; i++) result.current.registerFailure();
    });

    expect(result.current.isLocked).toBe(true);
    const remainingAfterLockout = result.current.remainingSeconds;

    // Further failures while locked must not change the lockout state.
    await act(() => {
      result.current.registerFailure();
      result.current.registerFailure();
    });

    expect(result.current.isLocked).toBe(true);
    expect(result.current.remainingSeconds).toBe(remainingAfterLockout);
  });

  it('registerSuccess resets the lockout', async () => {
    const { result } = await renderHook(() => useAttemptLockout(5, 30));

    await act(() => {
      for (let i = 0; i < 5; i++) result.current.registerFailure();
    });
    expect(result.current.isLocked).toBe(true);

    await act(() => {
      result.current.registerSuccess();
    });

    expect(result.current.isLocked).toBe(false);
    expect(result.current.attemptsRemaining).toBe(5);
  });

  it('counts remainingSeconds down over time', async () => {
    const { result } = await renderHook(() => useAttemptLockout(5, 30));

    await act(() => {
      for (let i = 0; i < 5; i++) result.current.registerFailure();
    });
    expect(result.current.remainingSeconds).toBe(30);

    await act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.remainingSeconds).toBe(25);

    await act(() => {
      jest.advanceTimersByTime(25000);
    });
    expect(result.current.isLocked).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
  });
});

import { withTimeout } from './withTimeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves and clears the timer', async () => {
    await expect(withTimeout(Promise.resolve(1), 1000)).resolves.toBe(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears the timer when the promise rejects', async () => {
    await expect(withTimeout(Promise.reject(new Error('x')), 1000)).rejects.toThrow('x');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects after the timeout', async () => {
    const result = withTimeout(new Promise(() => undefined), 1000);
    const assertion = expect(result).rejects.toThrow('timeout');
    jest.advanceTimersByTime(1000);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });
});

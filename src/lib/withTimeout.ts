/** The app's own timeout (see `withTimeout`): the only timeout that counts as "no connection". */
export class RequestTimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'RequestTimeoutError';
  }
}

/** Rejects with a `RequestTimeoutError` after `ms`; the timer is always cleared once the promise settled. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

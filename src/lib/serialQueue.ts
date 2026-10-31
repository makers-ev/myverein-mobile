/**
 * Runs async jobs strictly one after the other, whatever each one's outcome (a failed job does not block the next).
 * The draft autosave uses it so a slow save can never overtake or overwrite a newer one.
 */
export function createSerialQueue(): <T>(job: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const run = tail.then(job, job);
    tail = run.catch(() => undefined);
    return run;
  };
}

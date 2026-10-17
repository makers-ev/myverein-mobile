import { createSerialQueue } from './serialQueue';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('createSerialQueue', () => {
  it('never runs two jobs at the same time and keeps the order', async () => {
    const enqueue = createSerialQueue();
    const log: string[] = [];
    let running = 0;
    const job = (name: string, ms: number) => async () => {
      running++;
      expect(running).toBe(1);
      log.push(`start ${name}`);
      await delay(ms);
      log.push(`end ${name}`);
      running--;
      return name;
    };
    const results = await Promise.all([enqueue(job('slow', 30)), enqueue(job('fast', 1)), enqueue(job('last', 1))]);
    expect(results).toEqual(['slow', 'fast', 'last']);
    expect(log).toEqual(['start slow', 'end slow', 'start fast', 'end fast', 'start last', 'end last']);
  });

  it('continues after a failed job and still reports the failure to its caller', async () => {
    const enqueue = createSerialQueue();
    const failing = enqueue(async () => {
      throw new Error('boom');
    });
    const next = enqueue(async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });
});

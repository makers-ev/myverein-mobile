import { queueCommand } from './kalenderCommand';

describe('queueCommand', () => {
  it('makes two taps of the same action two commands', () => {
    const a = queueCommand(null, 'feeds');
    const b = queueCommand(a, 'feeds');
    expect(a).toEqual({ kind: 'feeds', n: 1 });
    expect(b).not.toBe(a);
    expect(b.n).toBe(2);
  });
});

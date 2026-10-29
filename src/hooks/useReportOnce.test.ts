import { renderHook } from '@testing-library/react-native';

import { useReportOnce } from './useReportOnce';

describe('useReportOnce', () => {
  it('fires once per key even with a new callback on every render', async () => {
    const calls: string[] = [];
    const { rerender } = await renderHook((p: { active: boolean; key: string }) => useReportOnce(p.active, p.key, () => calls.push(p.key)), { initialProps: { active: true, key: 'a' } });
    await rerender({ active: true, key: 'a' });
    await rerender({ active: true, key: 'a' });
    expect(calls).toEqual(['a']);
    await rerender({ active: true, key: 'b' });
    expect(calls).toEqual(['a', 'b']);
    await rerender({ active: false, key: 'b' });
    await rerender({ active: true, key: 'b' });
    expect(calls).toEqual(['a', 'b', 'b']);
  });

  it('does nothing while inactive or without a key', async () => {
    const cb = jest.fn();
    await renderHook(() => useReportOnce(false, 'a', cb));
    await renderHook(() => useReportOnce(true, null, cb));
    expect(cb).not.toHaveBeenCalled();
  });
});

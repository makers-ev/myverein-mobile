import React from 'react';
import { render } from '@testing-library/react-native';

import ChildrenCustomFields from './ChildrenCustomFields';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/hooks/useMyChildren', () => ({
  ...jest.requireActual('@/hooks/useMyChildren'),
  useMyChildren: () => ({
    children: [
      { clubMemberId: 'k1', displayName: 'Mia', firstName: 'Mia', lastName: null, status: 'aktiv' },
      { clubMemberId: 'k2', displayName: 'Tom', firstName: 'Tom', lastName: null, status: 'aktiv' },
    ],
    loading: false,
    reload: jest.fn(),
  }),
}));

const mockRenders: Record<string, number> = {};
jest.mock('./MemberCustomFields', () => {
  const { useEffect } = jest.requireActual('react');
  // Mimics a card with unsaved edits whose effect depends on the callback identity (the shape that looped).
  function MockCard({ target, onDirtyChange }: { target: string; onDirtyChange?: (d: boolean) => void }) {
    mockRenders[target] = (mockRenders[target] ?? 0) + 1;
    useEffect(() => {
      onDirtyChange?.(true);
      return () => onDirtyChange?.(false);
    }, [onDirtyChange]);
    return null;
  }
  return { __esModule: true, default: MockCard };
});

describe('ChildrenCustomFields', () => {
  it('reports the dirty state of each child once and stays stable across parent re-renders', async () => {
    const onDirty = jest.fn();
    const { rerender } = await render(<ChildrenCustomFields clubId="c1" onDirtyChange={onDirty} />);
    await rerender(<ChildrenCustomFields clubId="c1" onDirtyChange={(d) => onDirty(d)} />);
    await rerender(<ChildrenCustomFields clubId="c1" onDirtyChange={(d) => onDirty(d)} />);
    expect(onDirty.mock.calls.every(([d]) => d === true)).toBe(true);
    expect(onDirty).toHaveBeenCalledTimes(2); // one report per child turning dirty, none after re-renders
    expect(mockRenders.k1).toBeLessThanOrEqual(3);
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';

import ExternalStartRedirect from './ExternalStartRedirect';

jest.mock('@/navigation/AppNavigator', () => ({}));
const mockGoToTab = jest.fn();
let mockRoute = 'Dashboard';
jest.mock('@/navigation/navigationRef', () => ({
  goToTab: (...a: unknown[]) => mockGoToTab(...a),
  navigationRef: { isReady: () => true, getCurrentRoute: () => ({ name: mockRoute }), addListener: () => () => undefined },
}));
let mockAccess: { role: string | null; roles: string[]; reduced: boolean } = { role: null, roles: [], reduced: false };
jest.mock('./ExternalAccessProvider', () => ({ useExternalAccess: () => mockAccess }));

beforeEach(() => {
  mockGoToTab.mockReset();
  mockRoute = 'Dashboard';
  mockAccess = { role: null, roles: [], reduced: false };
});

describe('ExternalStartRedirect', () => {
  it('leaves normal members alone', async () => {
    await render(<ExternalStartRedirect />);
    expect(mockGoToTab).not.toHaveBeenCalled();
  });

  it('moves a sponsor from a member screen to Partner', async () => {
    mockAccess = { role: 'sponsor', roles: ['sponsor'], reduced: true };
    await render(<ExternalStartRedirect />);
    expect(mockGoToTab).toHaveBeenCalledWith('Partner');
  });

  it('moves a service provider to Einsatz and keeps it there', async () => {
    mockAccess = { role: 'dienstleister', roles: ['dienstleister'], reduced: true };
    mockRoute = 'Einsatz';
    await render(<ExternalStartRedirect />);
    expect(mockGoToTab).not.toHaveBeenCalled();
  });

  it('does not bounce an account with both roles from Einsatz back to Partner', async () => {
    mockAccess = { role: 'sponsor', roles: ['sponsor', 'dienstleister'], reduced: true };
    mockRoute = 'Einsatz';
    await render(<ExternalStartRedirect />);
    expect(mockGoToTab).not.toHaveBeenCalled();
  });

  it('keeps an account with an unknown role (fail closed) on the loading/retry screen', async () => {
    mockAccess = { role: null, roles: [], reduced: true };
    await render(<ExternalStartRedirect />);
    expect(mockGoToTab).toHaveBeenCalledWith('Partner');
    mockGoToTab.mockReset();
    mockRoute = 'Partner';
    await render(<ExternalStartRedirect />);
    expect(mockGoToTab).not.toHaveBeenCalled();
  });

  it('allows Mehr and Settings for every reduced role', async () => {
    mockAccess = { role: 'sponsor', roles: ['sponsor'], reduced: true };
    for (const route of ['Mehr', 'Settings']) {
      mockRoute = route;
      await render(<ExternalStartRedirect />);
    }
    expect(mockGoToTab).not.toHaveBeenCalled();
  });
});

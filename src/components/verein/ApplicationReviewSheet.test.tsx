import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/lib/api';
import ApplicationReviewSheet from './ApplicationReviewSheet';
import type { ClubApplication } from '@/lib/applicationReview';

jest.mock('@/auth/auth-client', () => ({ authClient: {}, backendUrl: 'http://test' }));
jest.mock('@/contexts/translation/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'de' }),
}));
jest.mock('@/theme/colors', () => ({
  useThemeColors: () => new Proxy({}, { get: () => '#000' }),
}));
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return { AlertTriangle: Icon, Baby: Icon, Check: Icon, FileText: Icon, Lock: Icon, ShieldCheck: Icon, X: Icon };
});
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/media', () => ({ clearReviewFileCache: jest.fn(), downloadReviewImage: jest.fn() }));
jest.mock('@/hooks/useClubMembers', () => ({ useMemberCategories: () => ({ categories: [] }) }));
const mockReview = {
  application: { id: 'a1', status: 'pending', onBehalfOf: 'self', legacy: false, createdAt: '2026-10-01T10:00:00Z', decidedAt: null, category: 'aktiv', birthDate: null },
  applicant: { userId: 'u', name: 'Anna', email: 'a@b.de' },
  subject: { displayName: 'Anna', birthDate: null, ageYears: null, ageBand: null, isMinor: null },
  form: null,
  answers: [],
  answersRetained: true,
  mapping: { preview: false, entries: [] },
  files: [],
  consent: null,
  duplicates: [],
  warnings: [],
  decision: null,
};
jest.mock('@/hooks/useClubApplications', () => ({
  useApplicationReview: () => ({ review: mockReview, loading: false, error: null, refetch: jest.fn() }),
}));

const application = { id: 'a1', name: 'Anna', onBehalfOf: 'self', category: 'aktiv' } as ClubApplication;

describe('ApplicationReviewSheet', () => {
  it('turns read-only after a stale decision and tells the list to reload', async () => {
    const onDecided = jest.fn();
    const approve = jest.fn().mockRejectedValue(new ApiError(409, 'CONFLICT', 'Application has already been decided'));
    await render(<ApplicationReviewSheet clubId="c1" application={application} onClose={jest.fn()} onDecided={onDecided} approve={approve} reject={jest.fn()} />);
    expect(screen.getByText('verein.applications.approve')).toBeTruthy();
    await fireEvent.press(screen.getByText('verein.applications.approve'));
    // the message stays visible, the decision buttons are gone, only "close" is left
    expect(screen.getByText('forms.review.err.decided')).toBeTruthy();
    expect(screen.queryByText('verein.applications.approve')).toBeNull();
    expect(screen.queryByText('verein.applications.reject')).toBeNull();
    expect(screen.getByText('forms.review.close')).toBeTruthy();
    expect(onDecided).toHaveBeenCalledWith(null);
  });

  it('keeps the buttons on a busy decision (a hint, not staleness) and reports a success', async () => {
    const onDecided = jest.fn();
    const approve = jest.fn().mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'm', { code: 'decision_busy' })).mockResolvedValueOnce({ mapping: { skipped: [] } });
    await render(<ApplicationReviewSheet clubId="c1" application={application} onClose={jest.fn()} onDecided={onDecided} approve={approve} reject={jest.fn()} />);
    await fireEvent.press(screen.getByText('verein.applications.approve'));
    expect(screen.getByText('forms.err.decisionBusy')).toBeTruthy();
    expect(onDecided).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('verein.applications.approve'));
    expect(onDecided).toHaveBeenCalledWith({ action: 'approved', name: 'Anna', child: false, skipped: 0 });
  });
});

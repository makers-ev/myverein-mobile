import { buildResolutionCorrection } from './resolutionCorrection';

const original = { description: 'Budget 2026', votesFor: 10, votesAgainst: 2, votesAbstain: 1, result: 'angenommen' };
const draft = { description: 'Budget 2026', votesFor: '10', votesAgainst: '2', votesAbstain: '1', result: 'angenommen', correctionNote: 'Zählfehler' };

describe('buildResolutionCorrection', () => {
  it('requires a correction note', () => {
    expect(buildResolutionCorrection(original, { ...draft, votesFor: '11', correctionNote: '  ' })).toBe('no-note');
  });
  it('rejects an unchanged resolution', () => {
    expect(buildResolutionCorrection(original, draft)).toBe('no-change');
  });
  it('sends only changed fields plus the trimmed note', () => {
    expect(buildResolutionCorrection(original, { ...draft, votesFor: '11', result: ' abgelehnt ', correctionNote: ' Zählfehler ' })).toEqual({
      votesFor: 11,
      result: 'abgelehnt',
      correctionNote: 'Zählfehler',
    });
  });
  it('keeps the original count for unparsable input', () => {
    expect(buildResolutionCorrection(original, { ...draft, votesAgainst: 'x' })).toBe('no-change');
  });
});

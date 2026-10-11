import { buildResolutionCorrection, isValidVoteCount, validateResolutionDraft } from './resolutionCorrection';

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

describe('validation', () => {
  it('accepts whole numbers up to the cap only', () => {
    expect(isValidVoteCount('0')).toBe(true);
    expect(isValidVoteCount('100000')).toBe(true);
    expect(isValidVoteCount('100001')).toBe(false);
    expect(isValidVoteCount('-1')).toBe(false);
    expect(isValidVoteCount('1.5')).toBe(false);
    expect(isValidVoteCount('')).toBe(false);
  });
  it('flags missing note, bad votes and empty required fields', () => {
    expect(validateResolutionDraft({ ...draft, correctionNote: '', votesFor: 'x', result: ' ' })).toEqual({ note: true, votes: true, required: true });
    expect(validateResolutionDraft(draft)).toEqual({ note: false, votes: false, required: false });
  });
});

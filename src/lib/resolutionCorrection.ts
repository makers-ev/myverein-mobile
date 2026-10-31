// Pure helper (no API imports, unit-testable) for `PATCH /meetings/:id/resolutions/:rid`.

export interface ResolutionFields {
  description: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: string;
}

export interface ResolutionDraft {
  description: string;
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
  result: string;
  correctionNote: string;
}

export type ResolutionCorrectionBody = Partial<ResolutionFields> & { correctionNote: string };

export const MAX_VOTES = 100000;

/** True for a whole number 0..MAX_VOTES (no sign, no decimals). */
export function isValidVoteCount(text: string): boolean {
  const trimmed = text.trim();
  return /^\d{1,6}$/.test(trimmed) && Number(trimmed) <= MAX_VOTES;
}

export type ResolutionDraftError = 'note' | 'votes' | 'required';

/** Field-level problems of a draft (empty = valid). Votes are validated individually via `isValidVoteCount`. */
export function validateResolutionDraft(draft: ResolutionDraft): { note: boolean; votes: boolean; required: boolean } {
  return {
    note: draft.correctionNote.trim() === '',
    votes: ![draft.votesFor, draft.votesAgainst, draft.votesAbstain].every(isValidVoteCount),
    required: draft.description.trim() === '' || draft.result.trim() === '',
  };
}

function count(text: string, fallback: number): number {
  return isValidVoteCount(text) ? Number(text.trim()) : fallback;
}

/**
 * Body containing only the fields that differ from `original`, plus the trimmed `correctionNote`.
 * Returns `'no-note'` without a note and `'no-change'` when nothing differs (the backend would 422 either).
 */
export function buildResolutionCorrection(original: ResolutionFields, draft: ResolutionDraft): ResolutionCorrectionBody | 'no-note' | 'no-change' {
  const correctionNote = draft.correctionNote.trim();
  if (!correctionNote) return 'no-note';
  const changes: Partial<ResolutionFields> = {};
  const description = draft.description.trim();
  const result = draft.result.trim();
  if (description && description !== original.description) changes.description = description;
  if (result && result !== original.result) changes.result = result;
  const votesFor = count(draft.votesFor, original.votesFor);
  const votesAgainst = count(draft.votesAgainst, original.votesAgainst);
  const votesAbstain = count(draft.votesAbstain, original.votesAbstain);
  if (votesFor !== original.votesFor) changes.votesFor = votesFor;
  if (votesAgainst !== original.votesAgainst) changes.votesAgainst = votesAgainst;
  if (votesAbstain !== original.votesAbstain) changes.votesAbstain = votesAbstain;
  if (Object.keys(changes).length === 0) return 'no-change';
  return { ...changes, correctionNote };
}

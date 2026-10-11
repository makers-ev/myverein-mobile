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

function count(text: string, fallback: number): number {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;
  return Number(trimmed);
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

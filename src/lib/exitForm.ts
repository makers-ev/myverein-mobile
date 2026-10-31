import type { RenderedAnswer } from './applicationReview';
import { type Answers, carryAnswers, droppedLabels, type FormDefinition, type FormField, isEmptyAnswer, outdatedFrom, visibleAnswers } from './formSchema';

/**
 * Pure helpers of the exit form (Wave 8 M4), ported from the website's `exitForm.ts`: the cancellation sheet renders the
 * club's published `austritt` form and sends the answers with the cancellation; the board's exit queue shows the submitted
 * answers. The notice logic stays in the club settings -- the form can never influence a date.
 */

/** Submission of an exit request as `GET /club-exit-requests/:id` returns it (`null`: no form was filled in). */
export interface ExitSubmission {
  id: string;
  formVersionId: string;
  version: number;
  submittedAt: string | null;
  answers: RenderedAnswer[];
}

/**
 * Body of `POST /club-exit-requests` with the exit form: the wished date (if any), the answers of the VISIBLE fields only and
 * the version the person saw (the server answers a stale version with `409 FORM_VERSION_OUTDATED`). The reason is never sent
 * separately: the answers are the record.
 */
export function exitRequestBody(
  desiredEffectiveOn: string | null,
  definition: Pick<FormDefinition, 'fields' | 'formVersionId'>,
  answers: Answers,
): Record<string, unknown> {
  return {
    ...(desiredEffectiveOn ? { desiredEffectiveOn } : {}),
    answers: visibleAnswers(exitFormFields(definition.fields), answers),
    formVersionId: definition.formVersionId,
  };
}

export interface ExitRepin {
  definition: FormDefinition;
  answers: Answers;
  /** Labels (from the old definition) of answers that do not exist in the new form. */
  dropped: string[];
}

/**
 * The club changed its exit form while the sheet was open (`409 FORM_VERSION_OUTDATED`): the new definition replaces the old
 * one, answers survive by key where the new form still asks for them. `null` = not an outdated-version error or the club has no
 * exit form any more (the caller shows a plain error then).
 */
export function repinExit(err: unknown, definition: Pick<FormDefinition, 'fields'>, answers: Answers): ExitRepin | null {
  const info = outdatedFrom(err);
  if (!info?.current) return null;
  const carried = carryAnswers(info.current.fields, answers);
  return { definition: info.current, answers: carried.answers, dropped: droppedLabels(definition.fields, carried.dropped) };
}

/**
 * The fields the cancellation sheet can show: it has no upload, so file and photo fields are left out (neither rendered, nor
 * validated, nor required -- a required upload field must never block a cancellation).
 */
export function exitFormFields(fields: readonly FormField[]): FormField[] {
  return fields.filter((f) => f.type !== 'file' && f.type !== 'image');
}

/** Body of a cancellation without the form (the form could not be loaded): the wished date and an optional plain reason. */
export function plainExitBody(desiredEffectiveOn: string | null, reason: string): Record<string, unknown> {
  const text = reason.trim();
  return { ...(desiredEffectiveOn ? { desiredEffectiveOn } : {}), ...(text ? { reason: text } : {}) };
}

/** Whether the person typed anything into the sheet (closing then asks for confirmation). */
export function exitDialogTouched(desiredEffectiveOn: string | null, answers: Answers): boolean {
  return !!desiredEffectiveOn || Object.values(answers).some((v) => !isEmptyAnswer(v));
}

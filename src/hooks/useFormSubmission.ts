import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import {
  type Answers,
  applyConflictKind,
  type ApplyConflict,
  applyPatch,
  carryAnswers,
  diffAnswers,
  type FieldErrorCode,
  fieldErrorsFromError,
  isEmailNotVerified,
  type FormDefinition,
  type FormFile,
  formErrorKey,
  lostEntryLabels,
  mergeConcurrentEdits,
  type OnBehalfOf,
  outdatedFrom,
  type OutdatedInfo,
  type Submission,
  validateAnswers,
  visibleAnswers,
} from '@/lib/formSchema';
import { discardPickerFile, uploadSubmissionFile } from '@/lib/media';
import { createSerialQueue } from '@/lib/serialQueue';

export const AUTOSAVE_DELAY_MS = 800;

export interface SubmittedResult {
  submission: Submission;
  warnings: unknown[];
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type SaveOutcome = 'ok' | 'blocked' | 'failed';

export interface PickedPhoto {
  uri: string;
  name: string;
  type: string;
  fileSize?: number | null;
}

export interface UseFormSubmissionOptions {
  slug: string;
  mode: OnBehalfOf;
  /** The club's currently published definition (`GET /club-forms/:slug/aufnahme`). */
  current: FormDefinition;
  /** A resumed draft with the definition it is pinned to; `outdated` = the club published a newer version meanwhile. */
  resume?: { submission: Submission; form: FormDefinition; outdated: boolean };
  onSubmitted: (result: SubmittedResult) => void;
  /** `ALREADY_MEMBER` / `APPLICATION_PENDING`: the owner shows the matching notice. */
  onConflict: (kind: ApplyConflict) => void;
  /** The draft was discarded (deleted): start over. */
  onDiscarded: () => void;
  /** The server refuses this applicant mode for a reason the owner explains (`email_not_verified` for a child application). */
  onBlocked?: (reason: 'email_not_verified') => void;
}

/**
 * Draft state machine of one application form (one club, one applicant mode). Owns the draft **on the server only**: it is
 * created lazily with the first answer or upload, then every change is saved with a debounced `PATCH`. All requests
 * that change the draft (create, patch, re-pin, submit, discard) run strictly one after the other through a serial
 * queue, so a slow save can never overtake or overwrite a newer one; what the server stored is the baseline of the next
 * diff. `FORM_VERSION_OUTDATED` re-pins the draft to the current version, keeps the answers per key and reports what was
 * dropped. Client validation is a convenience before submit; field errors of the server (`422 details.fields`) are shown
 * per field. No answer content is logged, cached or written to AsyncStorage -- it lives in React state/refs while the
 * form is open and in the backend draft.
 */
export function useFormSubmission({ slug, mode, current, resume, onSubmitted, onConflict, onDiscarded, onBlocked }: UseFormSubmissionOptions) {
  const [definition, setDefinition] = useState<FormDefinition>(resume?.form ?? current);
  const [answers, setAnswers] = useState<Answers>(resume?.submission.answers ?? {});
  const [files, setFiles] = useState<FormFile[]>(resume?.submission.files ?? []);
  const [errors, setErrors] = useState<Record<string, FieldErrorCode>>({});
  const [saveState, setSaveState] = useState<SaveState>(resume ? 'saved' : 'idle');
  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ labels: string[]; version: number } | null>(null);
  const [fatalKey, setFatalKey] = useState<string | null>(null);
  const [submitErrorKey, setSubmitErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasDraft, setHasDraft] = useState(Boolean(resume));
  const [discarding, setDiscarding] = useState(false);
  // Photos currently uploading: submit and discard wait for them (a submit would race the upload, a discard delete the draft under it).
  const [uploading, setUploading] = useState(0);
  const uploadingRef = useRef(0);

  // Mutable truth of the autosave machinery (state is only the display of it).
  const defRef = useRef(definition);
  const answersRef = useRef(answers);
  const filesRef = useRef(files);
  const idRef = useRef<string | null>(resume?.submission.id ?? null);
  const savedRef = useRef<Answers>(resume?.submission.answers ?? {});
  // Jobs (create, patch, re-pin, submit, discard) run strictly one after the other.
  const [enqueue] = useState(createSerialQueue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rejectedRef = useRef(new Map<string, string>());
  const lastErrorRef = useRef<unknown>(null);
  const alive = useRef(true);
  const outdatedSeen = useRef(false);
  const latest = useRef<{ save: () => Promise<SaveOutcome>; outdated: (info: OutdatedInfo) => Promise<void> } | null>(null);
  const propsRef = useRef({ slug, mode, current, onConflict, onSubmitted, onDiscarded, onBlocked });

  function setAnswersBoth(next: Answers) {
    answersRef.current = next;
    setAnswers(next);
  }
  function setFilesBoth(update: (prev: FormFile[]) => FormFile[]) {
    filesRef.current = update(filesRef.current);
    if (alive.current) setFiles(filesRef.current);
  }
  function setDefinitionBoth(next: FormDefinition) {
    defRef.current = next;
    setDefinition(next);
  }

  async function createDraft(initial: Answers): Promise<void> {
    const { slug: s, mode: m } = propsRef.current;
    const res = await apiFetch<{ data: { submission: Submission } }>('/form-submissions', {
      method: 'POST',
      body: {
        clubSlug: s,
        formVersionId: defRef.current.formVersionId,
        purpose: 'aufnahme',
        onBehalfOf: m,
        ...(Object.keys(initial).length > 0 ? { answers: initial } : {}),
      },
    });
    idRef.current = res.data.submission.id;
    savedRef.current = res.data.submission.answers ?? {};
    if (alive.current) setHasDraft(true);
  }

  /** Sends what changed since the last successful save. Must run inside the queue. */
  async function savePending(attempt = 0): Promise<SaveOutcome> {
    const def = defRef.current;
    const all = answersRef.current;
    // Answers that fail the (mirrored) validation are not sent: one invalid entry must not block the others.
    const skip = new Set(Object.keys(validateAnswers(def.fields, all, { mode: 'draft' })));
    for (const [key, json] of [...rejectedRef.current]) {
      if (JSON.stringify(all[key]) === json) skip.add(key);
      else rejectedRef.current.delete(key);
    }
    const patch = diffAnswers(savedRef.current, visibleAnswers(def.fields, all), skip);
    if (Object.keys(patch).length === 0) {
      if (alive.current && idRef.current) setSaveState('saved');
      return 'ok';
    }
    if (alive.current) setSaveState('saving');
    try {
      if (!idRef.current) {
        await createDraft(applyPatch({}, patch));
      } else {
        const res = await apiFetch<{ data: { submission: Submission } }>(`/form-submissions/${idRef.current}`, {
          method: 'PATCH',
          body: { answers: patch },
        });
        savedRef.current = res.data.submission.answers ?? {};
      }
      if (alive.current) {
        setSaveState('saved');
        setSaveErrorKey(null);
      }
      return 'ok';
    } catch (err) {
      lastErrorRef.current = err;
      const conflict = applyConflictKind(err);
      if (conflict && conflict !== 'other') {
        propsRef.current.onConflict(conflict);
        return 'failed';
      }
      const outdated = outdatedFrom(err);
      if (outdated) {
        await handleOutdated(outdated);
        return 'blocked';
      }
      const fieldErrors = fieldErrorsFromError(err);
      if (fieldErrors && attempt < 2) {
        for (const key of Object.keys(fieldErrors)) rejectedRef.current.set(key, JSON.stringify(all[key]));
        if (alive.current) {
          setErrors((e) => ({ ...e, ...fieldErrors }));
          setSaveState('idle');
        }
        // The valid changes of the same patch still go out.
        await savePending(attempt + 1);
        return 'blocked';
      }
      if (isEmailNotVerified(err)) propsRef.current.onBlocked?.('email_not_verified');
      if (alive.current) {
        setSaveState('error');
        setSaveErrorKey(formErrorKey(err));
      }
      return 'failed';
    }
  }

  /**
   * The club published a new version: move the draft to it (the server keeps the answers per key), keep what was typed
   * and report which answers had no place in the new form.
   */
  async function handleOutdated(info: OutdatedInfo, depth = 0): Promise<void> {
    const next = info.current;
    if (!next) {
      if (alive.current) setFatalKey('forms.apply.noForm');
      return;
    }
    const previous = defRef.current;
    const startAnswers = answersRef.current;
    const startFiles = filesRef.current;
    const local = visibleAnswers(previous.fields, startAnswers);
    const carriedLocal = carryAnswers(next.fields, local);
    let nextAnswers: Answers = carriedLocal.answers;
    let dropped = carriedLocal.dropped;
    let nextFiles: FormFile[] | null = null;
    try {
      if (idRef.current) {
        const baseline = carryAnswers(next.fields, savedRef.current).answers;
        const patch = diffAnswers(baseline, carriedLocal.answers);
        const repin = (answersPatch: Answers) =>
          apiFetch<{ data: { submission: Submission; repinned: boolean; droppedAnswerKeys: string[] } }>(
            `/form-submissions/${idRef.current}`,
            {
              method: 'PATCH',
              body: { formVersionId: next.formVersionId, ...(Object.keys(answersPatch).length > 0 ? { answers: answersPatch } : {}) },
            },
          );
        let res;
        try {
          res = await repin(patch);
        } catch (err) {
          const again = outdatedFrom(err);
          if (again && depth < 2) return handleOutdated(again, depth + 1);
          // A local value the new field refuses must not block the move itself; it is flagged on the next save.
          if (!fieldErrorsFromError(err)) throw err;
          res = await repin({});
        }
        const serverDropped = res.data.droppedAnswerKeys ?? [];
        savedRef.current = res.data.submission.answers ?? {};
        nextAnswers = {
          ...savedRef.current,
          ...Object.fromEntries(Object.entries(carriedLocal.answers).filter(([k]) => !serverDropped.includes(k))),
        };
        dropped = [...dropped, ...serverDropped];
        nextFiles = res.data.submission.files ?? [];
      } else {
        savedRef.current = {};
      }
    } catch (err) {
      lastErrorRef.current = err;
      const conflict = applyConflictKind(err);
      if (conflict && conflict !== 'other') {
        propsRef.current.onConflict(conflict);
        return;
      }
      if (alive.current) {
        setSaveState('error');
        setSaveErrorKey(formErrorKey(err));
      }
      return;
    }
    if (!alive.current) return;
    // Whatever was typed while the request ran is kept (the state of the form may have moved on meanwhile).
    const merged = mergeConcurrentEdits(startAnswers, answersRef.current, nextAnswers, next.fields);
    const labels = lostEntryLabels({
      oldFields: previous.fields,
      droppedKeys: dropped,
      finalAnswers: merged,
      oldFiles: startFiles,
      newFiles: nextFiles ?? (idRef.current ? filesRef.current : []),
    });
    rejectedRef.current.clear();
    outdatedSeen.current = true;
    setDefinitionBoth(next);
    setAnswersBoth(merged);
    if (nextFiles) setFilesBoth(() => nextFiles);
    else if (!idRef.current) setFilesBoth(() => []);
    setErrors({});
    setNotice({ labels, version: next.version });
    setSaveState(idRef.current ? 'saved' : 'idle');
    // Answers the server does not have yet (no draft was created, or typing during the request) go out with the next save.
    if (Object.keys(diffAnswers(savedRef.current, visibleAnswers(next.fields, merged))).length > 0) scheduleSave();
  }

  useEffect(() => {
    propsRef.current = { slug, mode, current, onConflict, onSubmitted, onDiscarded, onBlocked };
    latest.current = { save: () => savePending(), outdated: (info) => handleOutdated(info) };
  });

  useEffect(() => {
    alive.current = true;
    // A resumed draft that the club re-published meanwhile moves to the current version right away.
    if (resume?.outdated) {
      void enqueue(() => latest.current!.outdated({ current: propsRef.current.current, submissionId: resume.submission.id }));
    }
    const timer = timerRef;
    return () => {
      alive.current = false;
      // Unsaved typing is not lost when the form goes away (mode switch, other club): the save still runs.
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void enqueue(() => latest.current!.save());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only; everything else goes through refs
  }, []);

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void enqueue(() => latest.current!.save());
    }, AUTOSAVE_DELAY_MS);
  }

  /** Finishes a pending autosave (used before the form is replaced, e.g. by a mode switch). */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await enqueue(() => latest.current!.save());
  }, [enqueue]);

  const setAnswer = useCallback((key: string, value: unknown) => {
    setAnswersBoth({ ...answersRef.current, [key]: value });
    setErrors((e) => {
      if (!(key in e)) return e;
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
    setSubmitErrorKey(null);
    setSaveState('dirty');
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only touches refs and stable setters
  }, []);

  /** A draft must exist before files can be attached; it is created from the answers so far. */
  async function ensureDraft(): Promise<string> {
    await enqueue(async () => {
      const outcome = await savePending();
      if (!idRef.current && outcome !== 'blocked') {
        try {
          await createDraft({});
        } catch (err) {
          lastErrorRef.current = err;
          const conflict = applyConflictKind(err);
          if (conflict && conflict !== 'other') propsRef.current.onConflict(conflict);
          if (isEmailNotVerified(err)) propsRef.current.onBlocked?.('email_not_verified');
          const outdated = outdatedFrom(err);
          if (outdated) await handleOutdated(outdated);
        }
      }
    });
    if (!idRef.current) throw lastErrorRef.current ?? new Error('draft');
    return idRef.current;
  }

  /** Re-reads the draft's files (lost upload response, expired preview URLs). Never touches the answers. */
  const refreshFiles = useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    try {
      const res = await apiFetch<{ data: { submission: Submission } }>(`/form-submissions/${id}`);
      if (alive.current && idRef.current === id) setFilesBoth(() => res.data.submission.files ?? []);
    } catch {
      // keep what is shown; the next upload/refresh retries
    }
  }, []);

  const uploadFile = useCallback(
    async (fieldKey: string, asset: PickedPhoto, onProgress: (percent: number | null) => void, signal: AbortSignal): Promise<void> => {
      uploadingRef.current += 1;
      setUploading(uploadingRef.current);
      try {
        let id: string;
        try {
          id = await ensureDraft();
          if (signal.aborted) throw new Error('aborted');
        } catch (err) {
          // No upload starts, so nobody else deletes the picker's cache copy.
          discardPickerFile(asset.uri);
          throw err;
        }
        const result = await uploadSubmissionFile<FormFile>(id, fieldKey, asset, { signal, onProgress });
        if ('error' in result) {
          const err = result.error;
          const outdated = outdatedFrom(err);
          if (outdated && !signal.aborted) await enqueue(() => handleOutdated(outdated));
          // No server answer (network, timeout, abort): the photo may have been stored anyway -- reconcile the list.
          else if (!(err instanceof ApiError)) void refreshFiles();
          throw err;
        }
        const file = result.file;
        const field = defRef.current.fields.find((f) => f.key === fieldKey);
        setFilesBoth((prev) => (field?.type === 'image' ? [...prev.filter((f) => f.fieldKey !== fieldKey), file] : [...prev, file]));
        setErrors((e) => {
          if (!(fieldKey in e)) return e;
          const copy = { ...e };
          delete copy[fieldKey];
          return copy;
        });
      } finally {
        uploadingRef.current -= 1;
        if (alive.current) setUploading(uploadingRef.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read refs only
    [refreshFiles, enqueue],
  );

  const removeFile = useCallback(async (file: FormFile): Promise<void> => {
    if (!idRef.current) return;
    try {
      await apiFetch(`/form-submissions/${idRef.current}/files/${file.id}`, { method: 'DELETE' });
    } catch (err) {
      // Already gone (404): the list is simply out of date.
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
    setFilesBoth((prev) => prev.filter((f) => f.id !== file.id));
  }, []);

  /** Validates, saves and files the application. Returns the field errors to focus (empty = sent or failed with a message). */
  const submit = useCallback(async (): Promise<Record<string, FieldErrorCode>> => {
    if (uploadingRef.current > 0) {
      setSubmitErrorKey('forms.apply.uploadRunning');
      return {};
    }
    setSubmitErrorKey(null);
    outdatedSeen.current = false;
    const def = defRef.current;
    const clientErrors = validateAnswers(def.fields, answersRef.current, {
      mode: 'submit',
      uploadedFieldKeys: new Set(filesRef.current.map((f) => f.fieldKey)),
    });
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setSubmitErrorKey('forms.apply.checkEntries');
      return clientErrors;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSubmitting(true);
    let found: Record<string, FieldErrorCode> = {};
    try {
      const result = await enqueue(async () => {
        const outcome = await savePending();
        if (outcome !== 'ok') return { kind: outcome } as const;
        if (!idRef.current) await createDraft({});
        const res = await apiFetch<{ data: { submission: Submission; warnings?: unknown[] } }>(`/form-submissions/${idRef.current}/submit`, {
          method: 'POST',
          body: {},
        });
        return { kind: 'done', data: res.data } as const;
      });
      if (!alive.current) return found;
      if (result.kind === 'done') {
        propsRef.current.onSubmitted({ submission: result.data.submission, warnings: result.data.warnings ?? [] });
      } else if (result.kind === 'blocked') {
        // Either the form changed (notice shown) or the server flagged fields (errors shown).
        setSubmitErrorKey(outdatedSeen.current ? 'forms.err.outdated' : 'forms.apply.checkEntries');
      } else {
        setSubmitErrorKey(formErrorKey(lastErrorRef.current));
      }
    } catch (err) {
      if (!alive.current) return found;
      const conflict = applyConflictKind(err);
      if (conflict && conflict !== 'other') {
        propsRef.current.onConflict(conflict);
        return found;
      }
      const outdated = outdatedFrom(err);
      if (outdated) {
        await enqueue(() => handleOutdated(outdated));
        setSubmitErrorKey('forms.err.outdated');
        return found;
      }
      if (isEmailNotVerified(err)) propsRef.current.onBlocked?.('email_not_verified');
      const fieldErrors = fieldErrorsFromError(err);
      if (fieldErrors) {
        found = fieldErrors;
        setErrors(fieldErrors);
      }
      setSubmitErrorKey(formErrorKey(err));
    } finally {
      if (alive.current) setSubmitting(false);
    }
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read refs only
  }, [enqueue]);

  /** Deletes the draft (answers and files) on the server and tells the owner to start over. */
  const discard = useCallback(async (): Promise<void> => {
    if (uploadingRef.current > 0) {
      setSubmitErrorKey('forms.apply.uploadRunning');
      return;
    }
    setDiscarding(true);
    setSubmitErrorKey(null);
    try {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await enqueue(async () => {
        if (!idRef.current) return;
        try {
          await apiFetch(`/form-submissions/${idRef.current}`, { method: 'DELETE' });
        } catch (err) {
          // Already gone (404) counts as discarded.
          if (!(err instanceof ApiError && err.status === 404)) throw err;
        }
      });
      idRef.current = null;
      if (alive.current) propsRef.current.onDiscarded();
    } catch (err) {
      if (alive.current) {
        setSubmitErrorKey(formErrorKey(err));
        setDiscarding(false);
      }
    }
  }, [enqueue]);

  /** Tries a failed autosave again (the app came back to the foreground, the network may be back). */
  const retrySave = useCallback(() => {
    void enqueue(() => latest.current!.save());
  }, [enqueue]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    definition,
    answers,
    files,
    errors,
    saveState,
    saveErrorKey,
    notice,
    fatalKey,
    submitErrorKey,
    submitting,
    hasDraft,
    discarding,
    uploading,
    retrySave,
    setAnswer,
    uploadFile,
    removeFile,
    refreshFiles,
    submit,
    discard,
    flush,
    dismissNotice,
  };
}

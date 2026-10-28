import { isJobRunning, type GenerationJob } from './documents';

export const JOB_POLL_INTERVAL_MS = 1500;
export const JOB_POLL_MAX = 40;

/**
 * Polls a PDF job until it is no longer `wartet|rendert` (or `maxPolls` is reached, then the last known job is returned
 * and the caller treats it as "still running"). `isCancelled` stops the loop without another request (screen closed).
 * Returns `null` when cancelled. A failing poll request throws -- the caller decides (the job itself keeps running).
 */
export async function pollJob(
  first: GenerationJob,
  fetchJob: (id: string) => Promise<GenerationJob>,
  options: { sleep: (ms: number) => Promise<void>; isCancelled: () => boolean; maxPolls?: number; intervalMs?: number },
): Promise<GenerationJob | null> {
  let job = first;
  const max = options.maxPolls ?? JOB_POLL_MAX;
  for (let i = 0; i < max && isJobRunning(job); i++) {
    await options.sleep(options.intervalMs ?? JOB_POLL_INTERVAL_MS);
    if (options.isCancelled()) return null;
    job = await fetchJob(job.id);
  }
  return options.isCancelled() ? null : job;
}

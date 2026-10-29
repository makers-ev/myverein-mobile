import type { GenerationJob } from './documents';
import { pollJob } from './jobPolling';

const job = (status: GenerationJob['status'], documentId: string | null = null): GenerationJob => ({ id: 'j1', templateId: 't', status, errorCode: null, documentId });
const sleep = () => Promise.resolve();

describe('pollJob', () => {
  it('returns a finished job without polling', async () => {
    const fetchJob = jest.fn();
    expect(await pollJob(job('fertig', 'd1'), fetchJob, { sleep, isCancelled: () => false })).toEqual(job('fertig', 'd1'));
    expect(fetchJob).not.toHaveBeenCalled();
  });

  it('polls until the job is done', async () => {
    const fetchJob = jest.fn().mockResolvedValueOnce(job('rendert')).mockResolvedValueOnce(job('fertig', 'd1'));
    const result = await pollJob(job('wartet'), fetchJob, { sleep, isCancelled: () => false });
    expect(result?.documentId).toBe('d1');
    expect(fetchJob).toHaveBeenCalledTimes(2);
  });

  it('stops at the poll limit and returns the running job', async () => {
    const fetchJob = jest.fn().mockResolvedValue(job('rendert'));
    const result = await pollJob(job('wartet'), fetchJob, { sleep, isCancelled: () => false, maxPolls: 3 });
    expect(result?.status).toBe('rendert');
    expect(fetchJob).toHaveBeenCalledTimes(3);
  });

  it('returns null and stops when cancelled', async () => {
    const fetchJob = jest.fn();
    expect(await pollJob(job('wartet'), fetchJob, { sleep, isCancelled: () => true })).toBeNull();
    expect(fetchJob).not.toHaveBeenCalled();
  });
});

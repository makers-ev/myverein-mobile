import { monthBounds, type TimeEntry } from '@/lib/timeTracking';
import { useScopedResource } from './useScopedResource';

/**
 * "Meine Stunden": the caller's own entries (open and confirmed) of the month containing `month`, read from
 * `GET /time-entries?scope=mine`. Read only, nothing is persisted on the device.
 */
export function useMyHours(clubId: string | null, enabled: boolean, month: Date) {
  const { from, to } = monthBounds(month);
  const res = useScopedResource<TimeEntry[]>(clubId && enabled ? `/time-entries?clubId=${encodeURIComponent(clubId)}&scope=mine&from=${from}&to=${to}` : null);
  return { entries: res.data ?? [], loading: res.loading && !res.data, error: res.error, reload: res.reload };
}

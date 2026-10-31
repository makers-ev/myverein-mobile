import { monthBounds, type TeamHoursReport } from '@/lib/timeTracking';
import { useScopedResource } from './useScopedResource';

/**
 * Team overview: confirmed hours per person for the month containing `month` from `GET /time-report` (the server scopes
 * it: department leads see their own departments, hours only; amounts only with `time:read_rates`). Read only; the
 * export (CSV / Excel) exists on the website only. Nothing is persisted on the device.
 */
export function useTeamHours(clubId: string | null, enabled: boolean, month: Date) {
  const { from, to } = monthBounds(month);
  const res = useScopedResource<TeamHoursReport>(clubId && enabled ? `/time-report?clubId=${encodeURIComponent(clubId)}&from=${from}&to=${to}&groupBy=person` : null);
  return { report: res.data ?? null, loading: res.loading && !res.data, error: res.error, reload: res.reload };
}

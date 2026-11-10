import { asyncStore } from '@/lib/appStorage';
import { readWithMigration, writeItem } from '@/lib/storageMigration';

// Clubs whose Heute setup checklist the person hid (decision D6). Device-local UI preference, no personal data:
// a JSON array of club ids under `myverein.setup-checklist-dismissed`.
const KEY = 'setup-checklist-dismissed';

export async function getDismissedSetupClubs(): Promise<string[]> {
  try {
    const raw = await readWithMigration(asyncStore, KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function dismissSetupChecklist(clubId: string): Promise<void> {
  const current = await getDismissedSetupClubs();
  if (current.includes(clubId)) return;
  await writeItem(asyncStore, KEY, JSON.stringify([...current, clubId]));
}

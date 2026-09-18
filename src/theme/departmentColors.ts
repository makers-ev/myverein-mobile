// Fixed 8-swatch set for department color-coding (calendars, inventory
// location badges), cycled by department creation order -- same idea as
// MyHome's per-member calendar colors, one level up (per department instead
// of per person). See the company vault's "Product Color - MyVerein" doc.
// Deliberately independent of the active palette (ADR-008): a department's
// color must stay recognizable across theme switches and light/dark mode,
// the same way the vereinsblau palette's `accent` (Pokal-Gold) is reserved
// for CTAs and must not double as a department tag.
export const DEPARTMENT_COLORS = [
  '#2c4870', // Vereinsblau
  '#b8860b', // Pokal-Gold
  '#3f7a47', // Waldgrün
  '#7a2e3b', // Bordeaux
  '#1f5c5c', // Petrol
  '#6b4a7c', // Pflaume
  '#b85a29', // Terrakotta
  '#6b7280', // Schiefer -- default for club-wide items with no department
] as const;

export function getDepartmentColor(index: number | null | undefined): string {
  if (index === null || index === undefined || index < 0) {
    return DEPARTMENT_COLORS[DEPARTMENT_COLORS.length - 1];
  }
  return DEPARTMENT_COLORS[index % (DEPARTMENT_COLORS.length - 1)];
}
